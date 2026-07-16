// ルールプール定義（仕様書v2 3章 対応）
// stage: 'A' = 数値の前処理, 'B' = 演算子の意味変更, 'C' = 結果の後処理, 'D' = 表示演出
// priority: 段階内での適用順（小さいほど先に適用される）。
// ただし段階Dについては、この priority フィールドは表示上の並び順の目安に過ぎず、
// 実際の判定優先順位（複数の魔法ルールの条件が重なったときにどれが表示されるか）は
// ruleEngine.js の applyStageD 内で明示的にハードコードされている
// （クリリン(17) > 猫(15) > 班長(23) > 名言(16) > アホ(14) > 3歳児(20) の順）。
// example: ルールカード表示用の代表的な Before→After の例（あくまで表示用で、判定には使わない）。
//   ネタバレになる魔法ルール(16,17,23)は example をあえて null にして非表示にしている。
// flavor: ルールカードの説明文の下にイタリックで表示する一言。
//   非魔法ルール(段階A/B/C)は実際の式に組み込んだときの計算結果例、
//   魔法ルール(段階D)はジョークのフレーバーテキストとして使う。

export const RULES = [
  {
    id: 1,
    stage: 'A',
    priority: 1,
    label: '1は0として扱う',
    example: { before: '1', after: '0' },
    flavor: '例：1＋8なら1は0になり、0＋8＝8',
  },
  {
    id: 2,
    stage: 'A',
    priority: 2,
    label: '偶数は常に負の値として扱う',
    example: { before: '4', after: '-4' },
    flavor: '例：4＋9なら4は偶数なので-4になり、-4＋9＝5',
  },
  {
    id: 18,
    stage: 'A',
    priority: 3,
    label: '偶数は1を足す',
    example: { before: '4', after: '5' },
    flavor: '例：4＋9なら4は偶数なので5になり、5＋9＝14',
  },
  {
    id: 3,
    stage: 'A',
    priority: 4,
    label: '奇数は2倍にしてから計算する',
    example: { before: '3', after: '6' },
    flavor: '例：3＋4なら3は奇数なので6になり、6＋4＝10',
  },
  {
    id: 19,
    stage: 'A',
    priority: 5,
    label: '奇数は1を引く',
    example: { before: '3', after: '2' },
    flavor: '例：3＋4なら3は奇数なので2になり、2＋4＝6',
  },
  {
    id: 4,
    stage: 'A',
    priority: 6,
    label: '式の中の最小の数字だけ2倍にする',
    example: { before: '3', after: '6' },
    flavor: '例：3＋9なら3が最小なので6になり、6＋9＝15',
  },
  {
    id: 5,
    stage: 'A',
    priority: 7,
    label: '式の中の最大の数字だけ半分にする（小数点以下切り捨て）',
    example: { before: '9', after: '4' },
    flavor: '例：3＋9なら9が最大なので4になり、3＋4＝7',
  },
  {
    id: 6,
    stage: 'B',
    priority: 1,
    label: '引き算は掛け算として扱う',
    example: { before: '−', after: '×' },
    flavor: '例：8－3なら－が×として扱われ、8×3＝24',
  },
  {
    id: 7,
    stage: 'B',
    priority: 2,
    label: '掛け算は足し算として扱う',
    example: { before: '×', after: '＋' },
    flavor: '例：4×5なら×が＋として扱われ、4＋5＝9',
  },
  {
    id: 8,
    stage: 'B',
    priority: 3,
    label: '割り算は引き算として扱う',
    example: { before: '÷', after: '−' },
    flavor: '例：10÷2なら÷が－として扱われ、10－2＝8',
  },
  {
    id: 9,
    stage: 'B',
    priority: 4,
    label: '足し算は割り算として扱う',
    example: { before: '＋', after: '÷' },
    flavor: '例：8＋2なら＋が÷として扱われ、8÷2＝4',
  },
  {
    id: 10,
    stage: 'B',
    priority: 5,
    label: '演算子は同じ数でもう一度計算する（例：3+4+4=11）',
    example: { before: '3+4', after: '3+4+4=11' },
    flavor: '例：5－2なら－2をもう一度使って5－2－2＝1',
  },
  {
    id: 11,
    stage: 'C',
    priority: 1,
    label: '計算結果の数字を鏡のように反転させる（例：123→321）',
    example: { before: '123', after: '321' },
    flavor: '例：45＋78＝123の結果を反転して321になる',
  },
  {
    id: 12,
    stage: 'C',
    priority: 2,
    label: 'ぞろ目にする（結果の全部の桁を先頭の数字で揃える）',
    example: { before: '172', after: '111' },
    flavor: '例：86＋86＝172の結果をぞろ目にして111になる',
  },
  {
    id: 13,
    stage: 'C',
    priority: 3,
    label: '計算結果を2倍にする',
    example: { before: '8', after: '16' },
    flavor: '例：3＋5＝8の結果を2倍にして16になる',
  },
  {
    id: 21,
    stage: 'C',
    priority: 4,
    label: '計算結果を3倍にする',
    example: { before: '4', after: '12' },
    flavor: '例：3＋5＝8の結果を3倍にして24になる',
  },
  {
    id: 22,
    stage: 'C',
    priority: 5,
    label: '計算結果を半分にする（小数点以下切り捨て）',
    example: { before: '9', after: '4' },
    flavor: '例：3＋6＝9の結果を半分にして4になる',
  },
  {
    id: 17,
    stage: 'D',
    priority: 1,
    label: '計算結果が59か593のときに、フリーザへの怒りをためたサイヤ戦士が現れる',
    // ネタバレ防止のため例は非表示。
    example: null,
    flavor: 'あの地球人のように…？',
  },
  {
    id: 15,
    stage: 'D',
    priority: 2,
    label: '22、222、2222のとき猫が現れる',
    example: { before: '222', after: '🐱' },
    flavor: 'にゃぁん……',
  },
  {
    id: 23,
    stage: 'D',
    priority: 3,
    label: '11、111、1111のとき、打ちひしがれた班長が現れる',
    // ネタバレ防止のため例は非表示。
    example: null,
    flavor: '明日から頑張ろうという発想からは、何の芽も吹きはしない……！',
  },
  {
    id: 16,
    stage: 'D',
    priority: 4,
    label: '計算結果が42のとき、「人生、宇宙、すべての答え」が返ってくる',
    // ネタバレ防止のため例は非表示。
    example: null,
    flavor: 'さようなら、魚をありがとう',
  },
  {
    id: 14,
    stage: 'D',
    priority: 5,
    label: '3の倍数と3がつく数字のときだけアホになる',
    example: { before: '3', after: 'サーン！' },
    flavor: '世界のスター',
  },
  {
    id: 20,
    stage: 'D',
    priority: 6,
    label: '計算結果が100を超えると3歳児になる',
    example: { before: '150', after: '3歳児になる' },
    flavor: '何もかも嫌になったので３歳になりました。難しいことは一つもわかりません。',
  },
];

export function getRuleById(id) {
  return RULES.find((r) => r.id === id);
}

export function ruleListForClient() {
  // 子・親両方が見る一覧。段階分けは内部処理のみなのでフラットな一覧として返す。
  return RULES.map((r) => ({
    id: r.id,
    label: r.label,
    stage: r.stage,
    example: r.example,
    flavor: r.flavor,
  }));
}
