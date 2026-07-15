// ルールプール定義（仕様書 5章 対応）
// stage: 'A' = 数値の前処理, 'B' = 演算子の意味変更, 'C' = 結果の後処理
// priority: 段階内での適用順（小さいほど先に適用される）

export const RULES = [
  {
    id: 1,
    stage: 'A',
    priority: 2,
    label: '1は0として扱う',
  },
  {
    id: 2,
    stage: 'A',
    priority: 1,
    label: '1は足し算されるときに限り1として扱う（このルールは常に最優先で適用される）',
  },
  {
    id: 3,
    stage: 'A',
    priority: 3,
    label: '偶数は常に負の値として扱う',
  },
  {
    id: 4,
    stage: 'A',
    priority: 5,
    label: '奇数は2倍にしてから計算する',
  },
  {
    id: 5,
    stage: 'A',
    priority: 6,
    label: '5の倍数は0として扱う',
  },
  {
    id: 6,
    stage: 'A',
    priority: 4,
    label: '式の中の最大の数字だけ2倍にしてから計算する',
  },
  {
    id: 7,
    stage: 'B',
    priority: 8,
    label: '引き算は足し算として扱う（符号反転して加算）',
  },
  {
    id: 8,
    stage: 'B',
    priority: 9,
    label: '掛け算は足し算に置き換える（a×b → a+b）',
  },
  {
    id: 9,
    stage: 'B',
    priority: 10,
    label: '割り算は掛け算として扱う',
  },
  {
    id: 10,
    stage: 'B',
    priority: 7,
    label: '計算の順序を右から左に処理する（左右の演算順を逆転）',
  },
  {
    id: 11,
    stage: 'C',
    priority: 13,
    label: '計算結果の数字を鏡のように反転させる（例：123→321）',
  },
  {
    id: 12,
    stage: 'C',
    priority: 11,
    label: '計算結果が2桁以上なら各桁を合計する（例：47→11）',
  },
  {
    id: 13,
    stage: 'C',
    priority: 14,
    label: '計算結果を絶対値にする',
  },
  {
    id: 14,
    stage: 'C',
    priority: 12,
    label: '計算結果の一の位と十の位を入れ替える（例：47→74）',
  },
  {
    id: 15,
    stage: 'C',
    priority: 15,
    label: '計算結果を2倍にする',
  },
];

export function getRuleById(id) {
  return RULES.find((r) => r.id === id);
}

export function ruleListForClient() {
  // 子・親両方が見る一覧。段階分けは内部処理のみなのでフラットな一覧として返す。
  return RULES.map((r) => ({ id: r.id, label: r.label }));
}
