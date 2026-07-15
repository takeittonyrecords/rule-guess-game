// ゲーム進行ロジック（仕様書 4章対応）

// ターン順をシャッフルする（ゲーム開始時に1回だけ行う）
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 回答フェイズの判定（仕様書 4-3節）
// correctIds: 親が選んだ正解ルールID配列, chosenIds: 子が選んだルールID配列
export function judgeAnswer(correctIds, chosenIds) {
  const correctSet = new Set(correctIds);
  const chosenSet = new Set(chosenIds);

  const intersectionSize = [...chosenSet].filter((id) => correctSet.has(id)).length;
  const sameCount = correctSet.size === chosenSet.size;
  const exactMatch = sameCount && [...correctSet].every((id) => chosenSet.has(id));

  if (exactMatch) return 'CLEAR';
  if (sameCount) return 'C';
  if (intersectionSize > 0) return 'B';
  return 'INCORRECT';
}

export function currentChildId(room) {
  if (room.turnOrder.length === 0) return null;
  return room.turnOrder[room.currentTurnIndex];
}

// 次の子へターンを渡す。
// turnOrderはゲーム開始時に1回だけシャッフルされ、誰かがクリアするまで固定なので、
// ここでは単純に次のインデックスへ進め、末尾まで行ったら先頭に戻すだけでよい
// （以前は「1ラウンド終えたら先頭を末尾に回す」ローテーションを行っていたが、
// 2人プレイの場合に直前の人がそのまま次の手番にもなってしまう不具合があったため撤廃した）。
// turnTokenは「新しい手番が始まった」ことをクライアントに伝えるための単調増加カウンタ。
// 子が1人しかいない場合など、currentChildIdの値自体は変わらないことがあるため、
// 画面(ChildPredict)を確実にリセットさせる目的で用意している。
// 式を送信しただけ(手番はまだ終わっていない)ではturnTokenは変えない。
export function advanceTurn(room) {
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.turnToken = (room.turnToken || 0) + 1;
}
