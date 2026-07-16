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
import {
  judgeAnswer,
  shuffleArray,
  currentChildId,
  advanceTurn,
  pickRandomRuleIds,
  CPU_DIFFICULTIES,
} from './gameLogic.js';
import {
  createRoom,
  getRoom,
  deleteRoom,
  addMember,
  addCPU,
  removeCPU,
  setCPUDifficulty,
  findMemberBySocket,
  findMemberById,
  findRoomBySocket,
  isHost,
  cleanupExpiredRooms,
  MAX_MEMBERS_COUNT,
} from './roomStore.js';

const PORT = process.env.PORT || 3001;

// 再接続の猶予期間（仕様: セッション永続化・再接続対応）
// ・ホストが切断: 2分間は部屋を解散せず待つ
// ・子(手番でも回答中でもない/親): 2分間は席を保持する
// ・子(予測フェイズの手番中): 30秒だけ手番を止め、それでも戻らなければ次の子へスキップ
//   （ただし本人の参加枠自体は上の2分間、引き続き保持される）
// ・子(回答フェイズ中=まさに卒業判定に挑戦中): 猶予なし、即座に回答権を放棄する
//   （ここで止めると部屋全体が進行不能になるため）
const HOST_GRACE_MS = 2 * 60 * 1000;
const PRESENCE_GRACE_MS = 2 * 60 * 1000;
const TURN_SKIP_MS = 30 * 1000;

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
  // 結果画面（卒業・廃校のどちらでもラウンドが終わった後）では、
  // 内訳や正解ルールを全員に公開する（もう推理する意味がないため）。
  if (room.phase === 'result') return true;
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
    members: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isCPU: !!m.isCPU,
      // 再接続対応: ソケットが外れている(=切断猶予期間中の)メンバーかどうか。
      // CPUはそもそもソケットを持たない仮想メンバーなので対象外。
      disconnected: !m.isCPU && !m.socketId,
      ...(m.isCPU ? { difficulty: m.difficulty || 'intermediate' } : {}),
    })),
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
    hintUsed: (room.hintsUsed || []).includes(viewerMemberId),
    // 再接続対応: ホストが切断猶予期間中かどうか（全員に見せてよい情報）
    hostDisconnected: !!room.hostDisconnected,
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
  room.hintsUsed = [];
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
  room.hintsUsed = [];
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

// 再接続対応: メンバーごとの猶予タイマー(presence/turnSkip)を解除する。
// 再接続(room:rejoin)できた時、または本人がすでに別の理由でメンバーから
// 削除された時に呼ぶ。
function clearMemberTimers(room, memberId) {
  room.pendingTimers = room.pendingTimers || {};
  const t = room.pendingTimers[memberId];
  if (!t) return;
  if (t.presenceTimer) clearTimeout(t.presenceTimer);
  if (t.turnSkipTimer) clearTimeout(t.turnSkipTimer);
  delete room.pendingTimers[memberId];
}

function clearHostTimer(room) {
  if (room.hostDisconnectTimer) {
    clearTimeout(room.hostDisconnectTimer);
    room.hostDisconnectTimer = null;
  }
}

// 部屋を削除する前に、その部屋に紐づく猶予タイマーを全て解除しておく
// （解除しないと、削除後の部屋オブジェクトに対して無意味なコールバックが後から実行されてしまう）。
function clearAllRoomTimers(room) {
  clearHostTimer(room);
  const timers = room.pendingTimers || {};
  for (const memberId of Object.keys(timers)) {
    clearMemberTimers(room, memberId);
  }
}

// 予測フェイズの「今の手番」が切断中のメンバーだった場合、30秒後に
// 自動でスキップするタイマーをセットする（すでにセット済みなら何もしない）。
// ターンが進むたびに呼び出すことで、次の手番も切断中だった場合に
// 連鎖的にスキップ猶予をセットし直せるようにしている。
function scheduleTurnSkipIfDisconnected(room) {
  if (room.phase !== 'predict') return;
  const curId = currentChildId(room);
  if (!curId) return;
  const curMember = findMemberById(room, curId);
  if (!curMember || curMember.socketId) return; // 接続中なら何もしない
  room.pendingTimers = room.pendingTimers || {};
  const existing = room.pendingTimers[curId] || {};
  if (existing.turnSkipTimer) return; // 既にスキップ猶予がセット済み
  existing.turnSkipTimer = setTimeout(() => handleTurnSkipTimeout(room, curId), TURN_SKIP_MS);
  room.pendingTimers[curId] = existing;
}

// 30秒の手番スキップ猶予が切れたときの処理。まだ切断中で、かつ実際にまだ
// 本人の手番のままであれば次の子へ進める。すでに再接続済み、または既に
// 別の理由で手番が進んでいれば何もしない。
function handleTurnSkipTimeout(room, memberId) {
  if (room.pendingTimers?.[memberId]) {
    room.pendingTimers[memberId].turnSkipTimer = null;
  }
  const member = findMemberById(room, memberId);
  if (!member || member.socketId) return;
  if (room.phase === 'predict' && currentChildId(room) === memberId) {
    advanceTurn(room);
    scheduleTurnSkipIfDisconnected(room);
    broadcastState(room);
  }
}

// 2分間の在席猶予が切れたときの処理。まだ再接続していなければ、本当に
// 退席したものとして扱う。親役だった場合はラウンド自体を中断してロビーへ、
// それ以外の子だった場合は手番表から外す（全員いなくなれば廃校画面へ）。
// まだロビー（ラウンド開始前）で親指名だけが外れる場合は指名を取り消すのみ。
function handlePresenceTimeout(room, memberId) {
  const member = findMemberById(room, memberId);
  if (!member || member.socketId) return; // 既に再接続済み
  clearMemberTimers(room, memberId);

  const wasParent = room.currentParentId === memberId;
  const wasInRound = room.phase !== 'lobby';

  room.members = room.members.filter((m) => m.id !== memberId);
  room.droppedOutIds = (room.droppedOutIds || []).filter((id) => id !== memberId);

  if (wasParent && wasInRound) {
    resetToLobby(room);
  } else if (wasParent) {
    room.currentParentId = null;
  } else if (wasInRound) {
    const hasRemainingChildren = removeChildFromTurnOrder(room, memberId);
    if (!hasRemainingChildren) {
      closeRound(room);
    } else {
      scheduleTurnSkipIfDisconnected(room);
    }
  }
  broadcastState(room);
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
      // ルールを自動選択して即座にラウンドを開始する。個数のレンジは
      // CPUの難易度設定(初級/中級/上級/ハードコア)による。
      const otherMembers = room.members.filter((m) => m.id !== target.id);
      if (otherMembers.length > 0) {
        const tier = CPU_DIFFICULTIES[target.difficulty] || CPU_DIFFICULTIES.intermediate;
        const ruleIds = pickRandomRuleIds(RULES.map((r) => r.id), tier.min, tier.max);
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

  // ホスト: CPUの難易度を変更する
  socket.on('host:setCPUDifficulty', ({ roomCode, difficulty } = {}, ack) => {
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
      ack?.({ ok: false, error: '今は難易度を変更できません' });
      return;
    }
    if (!CPU_DIFFICULTIES[difficulty]) {
      ack?.({ ok: false, error: '不明な難易度です' });
      return;
    }
    try {
      setCPUDifficulty(room, difficulty);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
      return;
    }
    ack?.({ ok: true });
    broadcastState(room);
  });

  // 親: ルール選択(1〜5個) -> 予測フェイズ開始
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
    if (ids.length < 1 || ids.length > 5) {
      ack?.({ ok: false, error: 'ルールは1〜5個選んでください' });
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
      // 次の手番が切断中のメンバーだった場合、30秒スキップ猶予をセットする
      // （goToAnswer側は今phaseがanswerなので、submitAnswerで再びpredictに
      // 戻るタイミングでこのチェックを行う）。
      scheduleTurnSkipIfDisconnected(room);
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
    if (ids.length < 1) {
      ack?.({ ok: false, error: 'ルールを1つ以上選んでください' });
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
    // 次の手番が切断中のメンバーだった場合に備えて、ここでスキップ猶予をセットする。
    scheduleTurnSkipIfDisconnected(room);
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
    } else {
      scheduleTurnSkipIfDisconnected(room);
    }
    ack?.({ ok: true });
    broadcastState(room);
  });

  // v2で追加: 子はラウンド中に1回だけ「ヒント」を使える。内容は自分が直前に送信した
  // 式に適用されたルールの内訳(trace)で、親の監視画面と同じ情報。他の子には見せない。
  // ackで本人にだけ内訳を返し、room.history自体は変更しない（他メンバーへの公開範囲は
  // 従来どおりhistoryForViewerに委ねる）。
  socket.on('child:useHint', ({ roomCode } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません' });
      return;
    }
    const member = findMemberBySocket(room, socket.id);
    if (!member || room.phase !== 'predict') {
      ack?.({ ok: false, error: '今はヒントを使えません' });
      return;
    }
    room.hintsUsed = room.hintsUsed || [];
    if (room.hintsUsed.includes(member.id)) {
      ack?.({ ok: false, error: 'ヒントはこのラウンドですでに使いました' });
      return;
    }
    const myEntries = room.history.filter((h) => h.childId === member.id);
    const last = myEntries[myEntries.length - 1];
    if (!last) {
      ack?.({ ok: false, error: 'まだ式を入力していません' });
      return;
    }
    room.hintsUsed.push(member.id);
    ack?.({
      ok: true,
      formulaDisplay: last.formulaDisplay,
      resultDisplay: last.resultDisplay,
      trace: last.trace || [],
    });
    broadcastState(room);
  });

  // 再接続対応: ブラウザ側にlocalStorageで保存しておいた{roomCode, memberId}を使って、
  // 新しいソケット接続を既存のメンバーに紐付け直す。ページ再読み込みや、通信が一時的に
  // 切れて自動再接続した場合の両方から呼ばれる想定。猶予期間(ホスト2分/子2分)内であれば、
  // 保留中の退席タイマーもここで解除する。同じmemberIdへ複数端末から同時に呼ばれた場合は
  // 単純に一番新しい接続で上書きする(気軽に遊ぶ用途のため、特別な競合対応はしない)。
  socket.on('room:rejoin', ({ roomCode, memberId } = {}, ack) => {
    const room = getRoom(roomCode);
    if (!room) {
      ack?.({ ok: false, error: '部屋が見つかりません（サーバーが再起動した可能性があります）' });
      return;
    }
    const member = findMemberById(room, memberId);
    if (!member) {
      ack?.({ ok: false, error: 'このセッションはもう有効ではありません' });
      return;
    }
    member.socketId = socket.id;
    socket.join(room.code);

    if (isHost(room, member.id)) {
      room.hostDisconnected = false;
      clearHostTimer(room);
    }
    clearMemberTimers(room, member.id);
    // 他に切断中のまま現在の手番になっているメンバーがいないか念のため確認する
    scheduleTurnSkipIfDisconnected(room);

    ack?.({ ok: true, roomCode: room.code, memberId: member.id });
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
    clearAllRoomTimers(room);
    io.to(room.code).emit('room:disbanded');
    deleteRoom(room.code);
    ack?.({ ok: true });
  });

  // 再接続対応: 切断されても即座にメンバーを削除せず、猶予期間だけ席を保持する。
  // 猶予期間内に room:rejoin が呼ばれれば復帰、呼ばれなければ本当に退席したものとして扱う。
  socket.on('disconnect', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const member = findMemberBySocket(room, socket.id);
    if (!member) return;

    member.socketId = null;

    if (isHost(room, member.id)) {
      // ホストが切断: 即解散せず2分間だけ待つ。その間は他のメンバーの操作は
      // 通常通り進行できる（ホストはロビー専用の操作権限を持つだけのため）。
      room.hostDisconnected = true;
      clearHostTimer(room);
      room.hostDisconnectTimer = setTimeout(() => {
        if (room.hostDisconnected) {
          clearAllRoomTimers(room);
          io.to(room.code).emit('room:disbanded');
          deleteRoom(room.code);
        }
      }, HOST_GRACE_MS);
      broadcastState(room);
      return;
    }

    const wasAnswering = room.phase === 'answer' && room.answeringChildId === member.id;
    const wasCurrentTurn = room.phase === 'predict' && currentChildId(room) === member.id;

    if (wasAnswering) {
      // 回答フェイズ中(まさに卒業判定に挑戦中)の本人が切断: 猶予を置かず即座に
      // 回答権を放棄して予測フェイズへ戻す。ここで止まると部屋全体が進行不能になるため。
      room.phase = 'predict';
      room.answeringChildId = null;
    }

    clearMemberTimers(room, member.id);
    room.pendingTimers = room.pendingTimers || {};
    const timers = {};

    if (wasCurrentTurn) {
      // 予測フェイズの手番中に切断: 30秒だけ止めて、それでも戻らなければ次の子へスキップ
      timers.turnSkipTimer = setTimeout(() => handleTurnSkipTimeout(room, member.id), TURN_SKIP_MS);
    }

    // 本人の参加枠自体は2分間保持する（この間にroom:rejoinすれば手番の順番も維持したまま復帰できる）
    timers.presenceTimer = setTimeout(() => handlePresenceTimeout(room, member.id), PRESENCE_GRACE_MS);
    room.pendingTimers[member.id] = timers;

    broadcastState(room);
  });
});

server.listen(PORT, () => {
  console.log(`rule-guess-game server listening on port ${PORT}`);
  console.log(`最大参加人数: ${MAX_MEMBERS_COUNT}人（ホスト含む）`);
});
