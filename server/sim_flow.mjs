import { createRoom, addMember, findMemberBySocket, isHost } from './src/roomStore.js';
import { shuffleArray, currentChildId, advanceTurn, judgeAnswer } from './src/gameLogic.js';

// ホストが部屋作成
const room = createRoom('sock-host', 'Host');
console.log('hostId:', room.hostId, 'code:', room.code);

// 2人参加
const m1 = addMember(room, 'sock-1', 'tama');
const m2 = addMember(room, 'sock-2', 'sana');
console.log('members:', room.members.map((m) => m.name));

// ホストが tama を親に指名
room.currentParentId = m1.id;
console.log('assigned parent:', room.members.find((m) => m.id === room.currentParentId).name);

// 親(tama)がルール選択 -> turnOrderは親以外(host, sana)になるはず
const others = room.members.filter((m) => m.id !== room.currentParentId);
room.selectedRuleIds = [3, 6];
room.turnOrder = shuffleArray(others.map((m) => m.id));
room.currentTurnIndex = 0;
room.phase = 'predict';
console.log('turnOrder (should exclude tama):', room.turnOrder.map((id) => room.members.find((m) => m.id === id).name));

// 現在の手番
console.log('current turn:', room.members.find((m) => m.id === currentChildId(room)).name);

// goToAnswer -> advanceTurn immediately
advanceTurn(room);
console.log('after goToAnswer, next queued turn:', room.members.find((m) => m.id === currentChildId(room)).name);

// judge
console.log('judge exact match:', judgeAnswer([3, 6], [3, 6]));
console.log('judge count match wrong content:', judgeAnswer([3, 6], [1, 2]));
console.log('judge partial overlap:', judgeAnswer([3, 6], [3, 1, 2]));
console.log('judge no overlap:', judgeAnswer([3, 6], [1, 2, 4]));

console.log('isHost check host:', isHost(room, room.hostId));
console.log('isHost check tama:', isHost(room, m1.id));
