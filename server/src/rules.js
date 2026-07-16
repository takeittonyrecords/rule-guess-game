// ルールプール定義（仕様書v2 3章 対応）
// stage: 'A' = 数値の前処理, 'B' = 演算子の意味変更, 'C' = 結果の後処理, 'D' = 表示演出
// priority: 段階内での適用順（小さいほど先に適用される）
// example: ルールカード表示用の代表的な Before→After の例（あくまで表示用で、判定には使わない）

export const RULES = [
  {
    id: 1,
    stage: 'A',
    priority: 1,
    label: '1は0として扱う',
    example: { before: '1', after: '0' },
  },
  {
    id: 2,
    stage: 'A',
    priority: 2,
    label: '偶数は常に負の値として扱う',
    example: { before: '4', after: '-4' },
  },
  {
    id: 3,
    stage: 'A',
    priority: 3,
    label: '奇数は2倍にしてから計算する',
    example: { before: '3', after: '6' },
  },
  {
    id: 4,
    stage: 'A',
    priority: 4,
    label: '式の中の最小の数字だけ2倍にする',
    example: { before: '3', after: '6' },
  },
  {
    id: 5,
    stage: 'A',
    priority: 5,
    label: '式の中の最大の数字だけ半分にする（小数点以下切り捨て）',
    example: { before: '9', after: '4' },
  },
  {
    id: 6,
    stage: 'B',
    priority: 1,
    label: '引き算は足し算として扱う',
    example: { before: '−', after: '＋' },
  },
  {
    id: 7,
    stage: 'B',
    priority: 2,
    label: '掛け算は足し算として扱う',
    example: { before: '×', after: '＋' },
  },
  {
    id: 8,
    stage: 'B',
    priority: 3,
    label: '割り算は引き算として扱う',
    example: { before: '÷', after: '−' },
  },
  {
    id: 9,
    stage: 'B',
    priority: 4,
    label: '足し算は割り算として扱う',
    example: { before: '＋', after: '÷' },
  },
  {
    id: 10,
    stage: 'B',
    priority: 5,
    label: '演算子は同じ数でもう一度計算する（例：3+4+4=11）',
    example: { before: '3+4', after: '3+4+4=11' },
  },
  {
    id: 11,
    stage: 'C',
    priority: 1,
    label: '計算結果の数字を鏡のように反転させる（例：123→321）',
    example: { before: '123', after: '321' },
  },
  {
    id: 12,
    stage: 'C',
    priority: 2,
    label: 'ぞろ目にする（結果の全部の桁を先頭の数字で揃える）',
    example: { before: '172', after: '111' },
  },
  {
    id: 13,
    stage: 'C',
    priority: 3,
    label: '計算結果を2倍にする',
    example: { before: '8', after: '16' },
  },
  {
    id: 14,
    stage: 'D',
    priority: 1,
    label: '3の倍数と3がつく数字のときだけアホになる',
    example: { before: '3', after: 'サーン！' },
  },
  {
    id: 15,
    stage: 'D',
    priority: 2,
    label: '22、222、2222のとき猫が現れる',
    example: { before: '222', after: '🐱' },
  },
  {
    id: 16,
    stage: 'D',
    priority: 3,
    label: '計算結果が42のとき、「人生、宇宙、すべての答え」が返ってくる',
    example: {
      before: '42',
      after: '「まちがいなくそれが答えです。率直なところ、みなさんのほうで究極の疑問が何であるかわかっていなかったところに問題があるのです」',
    },
  },
  {
    id: 17,
    stage: 'D',
    priority: 4,
    label: '計算結果が59か593のときに、フリーザへの怒りをためたサイヤ戦士が現れる',
    example: { before: '59', after: 'クリリンのことかーっ！！！' },
  },
];

export function getRuleById(id) {
  return RULES.find((r) => r.id === id);
}

export function ruleListForClient() {
  // 子・親両方が見る一覧。段階分けは内部処理のみなのでフラットな一覧として返す。
  return RULES.map((r) => ({ id: r.id, label: r.label, stage: r.stage, example: r.example }));
}
