// v2で追加: ルールの段階(A/B/C/D)ごとの色・アイコン・判定名などの共通定義。
// アイコンはTablerアイコンのクラス名を想定（例: <i className="ti ti-hash" />）。
// 実際のアイコンフォントを読み込むかはクライアントのビルド設定次第。読み込んでいない
// 場合はアイコンが表示されないだけで、文字ラベル部分の表示には影響しない。

export const STAGE_META = {
  A: { label: '数値', color: '#4a6cf7', bg: '#eaf0ff', icon: 'ti-hash' },
  B: { label: '記号', color: '#d97706', bg: '#fff3e0', icon: 'ti-divide' },
  C: { label: '結果', color: '#16a34a', bg: '#e8f8ee', icon: 'ti-refresh' },
  D: { label: '魔法', color: '#8b5cf6', bg: '#f3ecff', icon: 'ti-wand' },
};

export function stageMeta(stage) {
  return STAGE_META[stage] || { label: '?', color: '#888', bg: '#eee', icon: 'ti-help' };
}

// 回答フェイズの判定（5段階、仕様書v2 2-2節）
export const JUDGEMENT_LABEL = {
  GRADUATE: '卒業',
  EXCELLENT: '優',
  GOOD: '良',
  PASS: '可',
  FAIL: '不可',
};

export const JUDGEMENT_DESCRIPTION = {
  GRADUATE: 'おめでとう。だが、これから大きな試験がまだ待っているぞ。人生という、な……。',
  EXCELLENT: 'ルールの数はあっているけど、間違ったルールが含まれているぞ。惜しい！',
  GOOD: '正しいルールを含むが、ルールの数が間違っているぞ。まだまだだ！',
  PASS: 'ルールの数はあっているが、正しいルールが一つもない。やり直し！',
  FAIL: '何もわかっとらん。人生を見つめなおせ。',
};

// 計算結果の表示用の特殊マーカー。ruleEngine.js の displayType==='cat' のとき
// display フィールドにこの値が入る。
export const CAT_MARKER = '__CAT__';
