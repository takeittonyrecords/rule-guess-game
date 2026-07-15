import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { ruleListForClient } from './rules.js';
import { parseFormula, FormulaError } from './parser.js';
import { evaluateFormula } from './ruleEngine.js';
import { judgeAnswer, shuffleArray, currentChildId, advanceTurn } from './gameLogic.js';
import {
  createRoom,
  getRoom,
  deleteRoom,
  addMember,
  removeSocketFromRoom,
  findMemberBySocket,
  findMemberById,
  findRoomBySocket,
  isHost,
  cleanupExpiredRooms,
  MAX_MEMBERS_COUNT,
} from './roomStore.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ ok: true }));

// 本番デプロイ(Renderなど)では、クライアントのビルド成果物(client/dist)を
// このサーバーから配信して1サービスで完結させる。
// ローカル開発時はclient/distが存在しない(クライアントはVite devサーバー側で動く)ため、
// その場合はこのブロックは何もしない(既存のローカル開発フローに影響なし)。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(clientIndexPath);
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

setInterval(cleanupExpiredRooms, 10 * 60 * 1000);

function buildStateFor(room, viewerMemberId) {
  const base = {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    members: room.members.map((m) => ({ id: m.id, name: m.name })),
    currentParentId: room.currentParentId,
    rulesPool: ruleListForClient(),
    turnOrder: room.turnOrder,
    currentChildId: currentChildId(room),
    turnToken: room.turnToken || 0,
    history: room.history,
    answeringChildId: room.answeringChildId,
    ruleCountSelected: room.selectedRuleIds.length,
    lastResult: room.lastResult,
  };
  if (viewerMemberId && viewerMemberId === room.currentParentId) {
    base.selectedRuleIds = room.selectedRuleIds;
  }
  return base;
}

function broadcastState(room) {
  for (const member of room.members) {
    io.to(member.socketId).emit('state:update', buildStateFor(room, member.id));
  }
}

// ゲームの状態を初期化してロビーに戻す(親の指名からやり直し)
function resetToLobby(room) {
  room.phase = 'lobby';
  room.currentParentId = null;
  room.selectedRuleIds = [];
  room.turnOrder = [];
  room.currentTurnIndex = 0;
  room.turnToken = 0;
  room.history = [];
  room.answeringChildId = null;
  room.lastResult = null;
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ hostName } = {}, ack) => {
    const room = createRoom(socket.id, hostName);
    socket.join(room.code);
    ack?.({ ok: true, roomCode: room.code, memberId: room.hostId });
    broadcastState(room);
  });

  socket.on('room:join', ({ roomCode, memberName } = {}, ack) => {
    const code = (roomCode || '').trim().toUpperCase();
    const room = getRoom(code);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません（コードをご確認ください）' });
      return;
    }
    if (room.phase !== 'lobby') {
      ack?.({ ok: false, error: 'このゲームはすでに開始されています' });
      return;
    }
    try {
      const member = addMember(room, socket.id, memberName);
      socket.join(room.code);
      ack?.({ ok: true, roomCode: room.code, memberId: member.id });
      broadcastState(room);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ホスト: このラウンドの親を指名する（ロビー中のみ、何度でも変更可能）
  socket.on('host:assignParent', ({ roomCode, memberId } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const requester = findMemberBySocket(room, socket.id);
    if (!requester || !isHost(room, requester.id)) {
      ack?.({ ok: false, error: '権限がありません' });
      return;
    }
    if (room.phase !== 'lobby') {
      ack?.({ ok: false, error: '今は親を指名できません' });
      return;
    }
    const target = findMemberById(room, memberId);
    if (!target) {
      ack?.({ ok: false, error: '指定されたメンバーが見つかりません' });
      return;
    }
    room.currentParentId = target.id;
    ack?.({ ok: true });
    broadcastState(room);
  });

  // 親: ルール選択(2〜3個) -> 予測フェイズ開始
  socket.on('parent:selectRules', ({ roomCode, ruleIds } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const requester = findMemberBySocket(room, socket.id);
    if (!requester || requester.id !== room.currentParentId) {
      ack?.({ ok: false, error: '権限がありません' });
      return;
    }
    const otherMembers = room.members.filter((m) => m.id !== room.currentParentId);
    if (otherMembers.length === 0) {
      ack?.({ ok: false, error: '他のメンバーが参加していません' });
      return;
    }
    const ids = Array.from(new Set(ruleIds || []));
    if (ids.length < 2 || ids.length > 3) {
      ack?.({ ok: false, error: 'ルールは2〜3個選んでください' });
      return;
    }
    room.selectedRuleIds = ids;
    room.turnOrder = shuffleArray(otherMembers.map((m) => m.id));
    room.currentTurnIndex = 0;
    room.turnToken = 0;
    room.history = [];
    room.phase = 'predict';
    room.answeringChildId = null;
    room.lastResult = null;
    ack?.({ ok: true });
    broadcastState(room);
  });

  // 子: 手番中に計算式を送信
  socket.on('child:submitFormula', ({ roomCode, formula } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const member = findMemberBySocket(room, socket.id);
    if (!member) {
      ack?.({ ok: false, error: '参加者情報が見つかりません' });
      return;
    }
    if (room.phase !== 'predict') {
      ack?.({ ok: false, error: '今は予測フェイズではありません' });
      return;
    }
    if (currentChildId(room) !== member.id) {
      ack?.({ ok: false, error: 'あなたの手番ではありません' });
      return;
    }
    let parsed;
    try {
      parsed = parseFormula(formula);
    } catch (err) {
      if (err instanceof FormulaError) {
        ack?.({ ok: false, error: err.message });
        return;
      }
      throw err;
    }
    const result = evaluateFormula(parsed, room.selectedRuleIds);
    room.history.push({
      childId: member.id,
      childName: member.name,
      formulaDisplay: parsed.display,
      resultDisplay: result.display,
    });
    ack?.({ ok: true, resultDisplay: result.display });
    broadcastState(room);
  });

  // 子: 自分の手番の最後に「回答フェイズへ」or「次の子へターンを渡す」を選ぶ
  socket.on('child:endTurn', ({ roomCode, action } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const member = findMemberBySocket(room, socket.id);
    if (!member || room.phase !== 'predict' || currentChildId(room) !== member.id) {
      ack?.({ ok: false, error: '操作できません' });
      return;
    }
    if (action === 'goToAnswer') {
      room.phase = 'answer';
      room.answeringChildId = member.id;
      // 回答に進んだ時点で手番を次の子に渡しておく。こうすることで、
      // この子が不正解で予測フェイズに戻ったときには既に次の子の手番になっている。
      advanceTurn(room);
    } else {
      advanceTurn(room);
    }
    ack?.({ ok: true });
    broadcastState(room);
  });

  // 回答フェイズ中の子: ルールを2つ以上選んで回答
  socket.on('child:submitAnswer', ({ roomCode, ruleIds } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const member = findMemberBySocket(room, socket.id);
    if (!member || room.phase !== 'answer' || room.answeringChildId !== member.id) {
      ack?.({ ok: false, error: '今はあなたの回答フェイズではありません' });
      return;
    }
    const ids = Array.from(new Set(ruleIds || []));
    if (ids.length < 2) {
      ack?.({ ok: false, error: 'ルールを2つ以上選んでください' });
      return;
    }
    const judgement = judgeAnswer(room.selectedRuleIds, ids);

    if (judgement === 'CLEAR') {
      room.phase = 'result';
      room.lastResult = {
        judgement,
        correctRuleIds: room.selectedRuleIds,
        clearedChildId: member.id,
        clearedChildName: member.name,
      };
      room.answeringChildId = null;
      ack?.({ ok: true, judgement });
      broadcastState(room);
      return;
    }

    // クリア以外: ペナルティなしで予測フェイズに戻る。
    // 手番はすでに goToAnswer の時点で次の子に渡してあるので、ここでは進めない。
    room.phase = 'predict';
    room.answeringChildId = null;
    ack?.({ ok: true, judgement });
    broadcastState(room);
  });

  // ホスト: ロビーに戻って次のラウンドの親指名からやり直す
  socket.on('host:resetToLobby', ({ roomCode } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const requester = findMemberBySocket(room, socket.id);
    if (!requester || !isHost(room, requester.id)) {
      ack?.({ ok: false, error: '権限がありません' });
      return;
    }
    resetToLobby(room);
    ack?.({ ok: true });
    broadcastState(room);
  });

  // ホスト: 部屋を解散する。参加者は全員トップ画面に強制的に戻される。
  socket.on('host:disbandRoom', ({ roomCode } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const requester = findMemberBySocket(room, socket.id);
    if (!requester || !isHost(room, requester.id)) {
      ack?.({ ok: false, error: '権限がありません' });
      return;
    }
    io.to(room.code).emit('room:disbanded');
    deleteRoom(room.code);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const member = findMemberBySocket(room, socket.id);
    if (!member) return;

    if (isHost(room, member.id)) {
      // ホストが抜けたら部屋ごと解散する
      io.to(room.code).emit('room:disbanded');
      deleteRoom(room.code);
      return;
    }

    const wasParent = room.currentParentId === member.id;
    removeSocketFromRoom(room, socket.id);

    if (wasParent && room.phase !== 'lobby') {
      // ゲーム進行中に親が抜けた場合は、そのラウンドを中断してロビーに戻す
      resetToLobby(room);
    } else if (room.phase !== 'lobby') {
      // 進行中の子が抜けた場合は手番表から外す
      const idx = room.turnOrder.indexOf(member.id);
      if (idx !== -1) {
        room.turnOrder.splice(idx, 1);
        if (room.turnOrder.length === 0) {
          resetToLobby(room);
        } else if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = 0;
        }
      }
    }
    broadcastState(room);
  });
});

server.listen(PORT, () => {
  console.log(`rule-guess-game server listening on port ${PORT}`);
  console.log(`最大参加人数: ${MAX_MEMBERS_COUNT}人（ホスト含む）`);
});
