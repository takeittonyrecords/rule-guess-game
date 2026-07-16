// 部屋の管理（メモリ上のみ、DB不要。仕様書 3章対応）
// 部屋コードは作成から12時間で自動失効。
//
// 「ホスト」と「ゲーム上の親」は別の役割。
// ホスト = 部屋を作成した人。部屋の解散・親の指名を行う権限を持つ(ゲームの参加者でもある)。
// 親 = メンバーの中からホストがラウンドごとに指名する1人。ルールを選ぶ人。
// 子 = そのラウンドで親に指名されなかった残りのメンバー。

const ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 12時間
const MAX_MEMBERS = 6; // ホストを含めた合計人数の上限
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0,O,1,I)は除外

const rooms = new Map(); // code -> room

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function generateMemberId() {
  return `m_${Math.random().toString(36).slice(2, 9)}`;
}

export function createRoom(hostSocketId, hostName) {
  const code = generateCode();
  const hostId = generateMemberId();
  const room = {
    code,
    createdAt: Date.now(),
    hostId,
    members: [{ id: hostId, socketId: hostSocketId, name: hostName || 'ホスト' }],
    currentParentId: null, // このラウンドの親(メンバーID)。未指名ならnull
    phase: 'lobby', // lobby -> predict -> answer -> result -> (lobbyに戻る)
    selectedRuleIds: [],
    turnOrder: [], // 親以外のメンバーIDの並び
    currentTurnIndex: 0,
    turnToken: 0,
    history: [], // { childId, childName, formulaDisplay, resultDisplay }
    answeringChildId: null,
    lastResult: null, // { judgement, correctRuleIds, clearedChildId, clearedChildName }
    droppedOutIds: [], // v2で追加: このラウンドで「あきらめた」子のメンバーID一覧。
                        // 抜けた子は以後、親と同じ監視画面(内訳つき)が見られる。
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (Date.now() - room.createdAt > ROOM_TTL_MS) {
    rooms.delete(code);
    return null;
  }
  return room;
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function addMember(room, socketId, name) {
  if (room.members.length >= MAX_MEMBERS) {
    throw new Error(`この部屋は満員です（最大${MAX_MEMBERS}人）`);
  }
  const id = generateMemberId();
  const member = { id, socketId, name: name || '参加者' };
  room.members.push(member);
  return member;
}

// CPU（ソケットを持たない仮想メンバー）を1体だけ追加する。
// 一人プレイ用: ホストがこのCPUを親に指名すると、ルールをランダムに自動選択して
// すぐに試験問題フェイズへ進む（server/src/index.jsのhost:assignParent参照）。
export function addCPU(room) {
  if (room.members.length >= MAX_MEMBERS) {
    throw new Error(`この部屋は満員です（最大${MAX_MEMBERS}人）`);
  }
  if (room.members.some((m) => m.isCPU)) {
    throw new Error('CPUはすでに追加されています');
  }
  const id = generateMemberId();
  const member = { id, socketId: null, name: 'CPU教授', isCPU: true };
  room.members.push(member);
  return member;
}

// 誤って追加したCPUを削除する。CPUが現在の親に指名されていた場合は指名も解除する。
export function removeCPU(room) {
  const cpu = room.members.find((m) => m.isCPU);
  if (!cpu) {
    throw new Error('CPUは追加されていません');
  }
  room.members = room.members.filter((m) => !m.isCPU);
  if (room.currentParentId === cpu.id) {
    room.currentParentId = null;
  }
}

export function removeSocketFromRoom(room, socketId) {
  room.members = room.members.filter((m) => m.socketId !== socketId);
}

export function findMemberBySocket(room, socketId) {
  return room.members.find((m) => m.socketId === socketId);
}

export function findMemberById(room, memberId) {
  return room.members.find((m) => m.id === memberId);
}

export function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.members.some((m) => m.socketId === socketId)) return room;
  }
  return null;
}

export function isHost(room, memberId) {
  return room.hostId === memberId;
}

// 期限切れ部屋の定期クリーンアップ
export function cleanupExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

export const MAX_MEMBERS_COUNT = MAX_MEMBERS;
