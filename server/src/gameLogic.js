// ゲーム進行ロジック（仕様書v2 2章対応）

// ターン順をシャッフルする（ゲーム開始時に1回だけ行う）
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 回答フェイズの判定（仕様書v2 2-2節、5段階）
// correctIds: 親が選んだ正解ルールID配列, chosenIds: 子が選んだルールID配列
// 戻り値: 'GRADUATE'(卒業) | 'EXCELLENT'(優) | 'GOOD'(良) | 'PASS'(可) | 'FAIL'(不可)
export function judgeAnswer(correctIds, chosenIds) {
  const correctSet = new Set(correctIds);
  const chosenSet = new Set(chosenIds);

  const intersectionSize = [...chosenSet].filter((id) => correctSet.has(id)).length;
  const sameCount = correctSet.size === chosenSet.size;
  const exactMatch = sameCount && [...correctSet].every((id) => chosenSet.has(id));

  if (exactMatch) return 'GRADUATE'; // 卒業: 個数も内容も完全一致
  if (sameCount) {
    // 個数は一致しているが内容は完全一致ではない場合、正解を含んでいるかで分ける
    return intersectionSize > 0 ? 'EXCELLENT' : 'PASS'; // 優 or 可
  }
  // 個数が不一致の場合（正解を全部含みつつ余分に選んでいるケースも含む）
  return intersectionSize > 0 ? 'GOOD' : 'FAIL'; // 良 or 不可
}

// CPU（親役）が使う: 候補ルールIDの中からminCount〜maxCount個をランダムに選ぶ。
// 難易度ごとの個数レンジはCPU_DIFFICULTIESを参照。
export function pickRandomRuleIds(allRuleIds, minCount = 1, maxCount = 5) {
  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
  return shuffleArray(allRuleIds).slice(0, count);
}

// v2で追加: CPU（一人プレイの仮想の親）の難易度設定。
// ホストがロビー画面で選べる4段階。selectRules/submitAnswerの許容範囲(1〜5個)の中の
// サブレンジとして、CPUが実際に選ぶルール個数を絞り込む。
export const CPU_DIFFICULTIES = {
  beginner: { label: '初級', min: 1, max: 2 },
  intermediate: { label: '中級', min: 1, max: 3 },
  advanced: { label: '上級', min: 2, max: 5 },
  hardcore: { label: 'ハードコア', min: 4, max: 5 },
};

export function currentChildId(room) {
  if (room.turnOrder.length === 0) return null;
  return room.turnOrder[room.currentTurnIndex];
}

// 次の子へターンを渡す。
// turnOrderはゲーム開始時に1回だけシャッフルされ、誰かが卒業するまで固定なので、
// ここでは単純に次のインデックスへ進め、末尾まで行ったら先頭に戻すだけでよい。
// turnTokenは「新しい手番が始まった」ことをクライアントに伝えるための単調増加カウンタ。
// 子が1人しかいない場合など、currentChildIdの値自体は変わらないことがあるため、
// 画面(ChildPredict)を確実にリセットさせる目的で用意している。
// 式を送信しただけ(手番はまだ終わっていない)ではturnTokenは変えない。
export function advanceTurn(room) {
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.turnToken = (room.turnToken || 0) + 1;
}
