import { advanceTurn, currentChildId } from './src/gameLogic.js';

const room = { turnOrder: ['tama', 'sana'], currentTurnIndex: 0, turnToken: 0 };
const seq = [];
for (let i = 0; i < 8; i += 1) {
  seq.push(currentChildId(room));
  advanceTurn(room);
}
console.log('2 players:', seq.join(' -> '));

const room3 = { turnOrder: ['a', 'b', 'c'], currentTurnIndex: 0, turnToken: 0 };
const seq3 = [];
for (let i = 0; i < 9; i += 1) {
  seq3.push(currentChildId(room3));
  advanceTurn(room3);
}
console.log('3 players:', seq3.join(' -> '));
