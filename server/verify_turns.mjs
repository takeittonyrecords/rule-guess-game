import { advanceTurn, currentChildId } from './src/gameLogic.js';

const room = { turnOrder: ['tama', 'sana'], currentTurnIndex: 0, turnToken: 0 };
const sequence = [];
for (let i = 0; i < 8; i += 1) {
  sequence.push(currentChildId(room));
  advanceTurn(room);
}
console.log('2人プレイの手番シーケンス:', sequence.join(' -> '));
const hasConsecutiveDup = sequence.some((v, i) => i > 0 && v === sequence[i - 1]);
console.log(hasConsecutiveDup ? 'NG: 連続重複あり' : 'OK: 連続重複なし');

const room3 = { turnOrder: ['a', 'b', 'c'], currentTurnIndex: 0, turnToken: 0 };
const seq3 = [];
for (let i = 0; i < 9; i += 1) {
  seq3.push(currentChildId(room3));
  advanceTurn(room3);
}
console.log('3人プレイの手番シーケンス:', seq3.join(' -> '));
const hasDup3 = seq3.some((v, i) => i > 0 && v === seq3[i - 1]);
console.log(hasDup3 ? 'NG: 連続重複あり' : 'OK: 連続重複なし');
