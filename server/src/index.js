import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import { ruleListForClient, RULES } from './rules.js';
import { parseFormula, FormulaError } from './parser.js';
import { evaluateFormula } from './ruleEngine.js';
import { judgeAnswer, shuffleArray, currentChildId, advanceTurn, pickRandomRuleIds } from './gameLogic.js';
import {
  createRoom,
  getRoom,
  deleteRoom,
  addMember,
  addCPU,
  removeCPU,
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

// v2で追加: 「親」と「あきらめて監視モードになった子」は、どちらも内訳(trace)や
// 正解ルールが見える「特権ビューア」として扱う。
function isPrivilegedViewer(room, viewerMemberId) {
  if (!viewerMemberId) return false;
  // 「廃校」結果画面（子が全員あきらめて誰も卒業できなかった）では、
  // 内訳や正解ルールを全員に公開する（もう推理する意味がないため）。
  if (room.phase === 'result' && room.lastResult?.judgement === 'CLOSED') return true;
  if (viewerMemberId === room.currentParentId) return true;
  return (room.droppedOutIds || []).includes(viewerMemberId);
}

// 履歴を閲覧者ごとに整形する。特権ビューアにはルール適用の内訳(trace)を
// そのまま見せるが、それ以外の子にはtraceを取り除いた履歴を渡す（ネタバレ防止）。
function historyForViewer(room, viewerMemberId) {
  if (isPrivilegedViewer(room, viewerMemberId)) {
    return room.history;
  }
  return room.history.map(({ trace, ...rest }) => rest);
}

function buildStateFor(room, viewerMemberId) {
  const base = {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    members: room.members.map((m) => ({ id: m.id, name: m.name, isCPU: !!m.isCPU })),
    currentParentId: room.currentParentId,
    rulesPool: ruleListForClient(),
    turnOrder: room.turnOrder,
    currentChildId: currentChildId(room),
    turnToken: room.turnToken || 0,
    history: historyForViewer(room, viewerMemberId),
    answeringChildId: room.answeringChildId,
    ruleCountSelected: room.selectedRuleIds.length,
    lastResult: room.lastResult,
    droppedOutIds: room.droppedOutIds || [],
  };
  if (isPrivilegedViewer(room, viewerMemberId)) {
    base.selectedRuleIds = room.selectedRuleIds;
  }
  return base;
}

function broadcastState(room) {
  for (const member of room.members) {
    io.to(member.socketId).emit('state:update', buildStateFor(room, member.id));
  }
}

// v2で追加: 子が全員あきらめたときに呼ぶ。即座にロビーへ戻すのではなく、
// 「廃校」の結果画面を全員に表示する。ロビーに戻る操作はホストが
// host:resetToLobby を明示的に呼ぶまで待つ。
function closeRound(room) {
  room.phase = 'result';
  room.lastResult = {
    judgement: 'CLOSED',
    correctRuleIds: room.selectedRuleIds,
  };
  room.answeringChildId = null;
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
  room.droppedOutIds = [];
}

// 親が選んだ(またはCPUが自動選択した)ルールでラウンドを開始する。
// parent:selectRules（人間の親）とhost:assignParent（CPUが親の場合の自動開始）の
// 両方から呼ばれる共通処理。
function startRound(room, ruleIds) {
  // CPUは親役専用（自分では手番を進められないため）なので、子の手番(turnOrder)には含めない。
  const otherMembers = room.members.filter((m) => m.id !== room.currentParentId && !m.isCPU);
  room.selectedRuleIds = ruleIds;
  room.turnOrder = shuffleArray(otherMembers.map((m) => m.id));
  room.currentTurnIndex = 0;
  room.turnToken = 0;
  room.history = [];
  room.phase = 'predict';
  room.answeringChildId = null;
  room.lastResult = null;
  room.droppedOutIds = [];
}

// turnOrderから指定メンバーを外す。「今まさに手番なのは誰か」をIDで捕まえておいてから
// 除外し、除外後の配列内でのそのIDのインデックスを引き直すことで、途中のメンバーが
// 抜けてもcurrentTurnIndexがずれないようにする。
// 戻り値: 除外後も子が1人以上残っていればtrue、誰もいなくなったらfalse。
function removeChildFromTurnOrder(room, memberId) {
  const currentId = room.turnOrder[room.currentTurnIndex];
  const idx = room.turnOrder.indexOf(memberId);
  if (idx !== -1) {
    room.turnOrder.splice(idx, 1);
  }
  if (room.turnOrder.length === 0) {
    room.currentTurnIndex = 0;
    return false;
  }
  const newIdx = room.turnOrder.indexOf(currentId);
  room.currentTurnIndex = newIdx !== -1 ? newIdx : 0;
  return true;
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
    if (target.isCPU) {
      // CPUが親の場合は自分で選択画面を開けないので、ここでランダムに
      // 2〜3個のルールを自動選択して即座にラウンドを開始する。
      const otherMembers = room.members.filter((m) => m.id !== target.id);
      if (otherMembers.length > 0) {
        const ruleIds = pickRandomRuleIds(RULES.map((r) => r.id));
        startRound(room, ruleIds);
      }
    }
    ack?.({ ok: true });
    broadcastState(room);
  });

  // ホスト: 部屋にCPU（一人プレイ用の仮想の親役）を1体追加する
  socket.on('host:addCPU', ({ roomCode } = {}, ack) => {
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
      ack?.({ ok: false, error: '今はCPUを追加できません' });
      return;
    }
    try {
      addCPU(room);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
      return;
    }
    ack?.({ ok: true });
    broadcastState(room);
  });

  // ホスト: 誤って追加したCPUを削除する
  socket.on('host:removeCPU', ({ roomCode } = {}, ack) => {
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
      ack?.({ ok: false, error: '今はCPUを削除できません' });
      return;
    }
    try {
      removeCPU(room);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
      return;
    }
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
    // CPUは子になれない（自分で手番を進められない）ため、人間のメンバーだけを数える。
    const otherMembers = room.members.filter((m) => m.id !== room.currentParentId && !m.isCPU);
    if (otherMembers.length === 0) {
      ack?.({ ok: false, error: '他のメンバーが参加していません' });
      return;
    }
    const ids = Array.from(new Set(ruleIds || []));
    if (ids.length < 2 || ids.length > 3) {
      ack?.({ ok: false, error: 'ルールは2〜3個選んでください' });
      return;
    }
    startRound(room, ids);
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
      ack?.({ ok: false, error: '今は試験問題の時間ではありません' });
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
      trace: result.trace || [],
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
      ack?.({ ok: false, error: '今はあなたの卒業判定の時間ではありません' });
      return;
    }
    const ids = Array.from(new Set(ruleIds || []));
    if (ids.length < 2) {
      ack?.({ ok: false, error: 'ルールを2つ以上選んでください' });
      return;
    }
    const judgement = judgeAnswer(room.selectedRuleIds, ids);

    if (judgement === 'GRADUATE') {
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

    // 卒業以外: ペナルティなしで予測フェイズに戻る。
    // 手番はすでに goToAnswer の時点で次の子に渡してあるので、ここでは進めない。
    room.phase = 'predict';
    room.answeringChildId = null;
    ack?.({ ok: true, judgement });
    broadcastState(room);
  });

  // v2で再設計: 「あきらめる」は本人だけがこのラウンドから抜ける操作。
  // 回答結果画面(AnswerFeedbackScreen)から呼ばれる想定で、この時点で
  // サーバー側のフェイズはすでにpredictに戻っている（submitAnswerの時点で戻すため）。
  // 抜けた本人は以後、親と同じ監視画面（内訳つき）が見られるようになる。
  // 子が全員あきらめた場合は、そのラウンドを終了してロビー（次のラウンド作成画面）に戻す。
  socket.on('child:giveUp', ({ roomCode } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const member = findMemberBySocket(room, socket.id);
    if (!member || room.phase !== 'predict') {
      ack?.({ ok: false, error: '今はあきらめられません' });
      return;
    }
    room.droppedOutIds = room.droppedOutIds || [];
    if (!room.droppedOutIds.includes(member.id)) {
      room.droppedOutIds.push(member.id);
    }
    const hasRemainingChildren = removeChildFromTurnOrder(room, member.id);
    if (!hasRemainingChildren) {
      closeRound(room);
    }
    ack?.({ ok: true });
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
      const hasRemainingChildren = removeChildFromTurnOrder(room, member.id);
      if (!hasRemainingChildren) {
        resetToLobby(room);
      }
    }
    broadcastState(room);
  });
});

server.listen(PORT, () => {
  console.log(`rule-guess-game server listening on port ${PORT}`);
  console.log(`最大参加人数: ${MAX_MEMBERS_COUNT}人（ホスト含む）`);
});
