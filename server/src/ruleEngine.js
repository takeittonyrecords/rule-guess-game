// ルール適用エンジン（v2）
// 仕様書v2 3章 に対応する実装。
//
// 設計上の前提（仕様書に明記のない細部について、実装のためにこちらで決めた挙動。
// 要すり合わせなら後で調整してください）:
// 1. 演算子の優先順位は導入しない。式は単純に左から右へ順番に計算する
//    （× ÷ を先に計算する、という一般的な優先順位は使わない）。
//    v1にあった「右から左に処理する」ルールはv2で削除されたため、常に左→右固定。
// 2. ルール6「引き算は足し算として扱う」は符号反転せず、単純に演算子を＋に
//    置き換えるだけの処理（例：5−3 → 5+3=8）。以前の「符号反転して加算」という
//    実装だと数学的に元の引き算と全く同じ値になり、選んでも結果が変わらない
//    （推理不可能な）ルールになってしまうため、この仕様検討時に修正した。
// 3. ルール10「演算子は同じ数でもう一度計算する」は、ルール6〜9で演算子の意味が
//    確定した後に、その場で同じ右辺の値を使ってもう一度同じ演算を行う
//    （例：3+4 → 3+4+4=11、10÷2 → 10÷2÷2=2.5）。
// 4. 段階Aの「最小/最大の数字」判定で、式中に同じ値が複数あり最小・最大が
//    タイになる場合は、該当する数字すべてに効果が及ぶ（v1の「最大」判定を踏襲）。
// 5. ルール適用によって（入力時点では0除算でなかったのに）割る数が0になってしまった
//    場合は、「計算不能（÷0）」という特殊な結果として扱う（手番は通常通り消費する）。
// 6. 段階Cの桁操作系ルール（鏡反転）は、結果の整数部分の絶対値に対して適用し、
//    符号は別途保持する。小数が出た場合は整数部分のみ桁操作の対象とし、
//    小数部分はそのまま保持する。
// 7. 段階D（表示演出）は段階A〜Cの計算が全て終わった最終結果に対して適用する。
//    ナベアツ風ルールとネコルールが両方選ばれていて、両方の条件を満たす場合は
//    ネコを優先する（例：計算結果が222の場合）。
// 8. ナベアツ風の読み上げでは、マイナス符号は読みに含めない（簡略化）。
//    小数が出た場合は「テン」のあとに小数部分の桁を1つずつ読む
//    （例：3.33 → サンテンサンサン）。数値の範囲は0〜9999まで正確な読みに対応し、
//    それ以外は桁ごとの読みにフォールバックする。

import { RULES, getRuleById } from './rules.js';

const DIV_BY_ZERO = Symbol('DIV_BY_ZERO');

function selectedRules(ruleIds, stage) {
  return ruleIds
    .map((id) => getRuleById(id))
    .filter((r) => r && r.stage === stage)
    .sort((a, b) => a.priority - b.priority);
}

// ---- 段階A: 数値の前処理 ----
function applyStageA(term, context, ruleIds) {
  const rulesA = selectedRules(ruleIds, 'A');
  let value = term;
  const original = term;
  const isEven = original % 2 === 0;

  for (const rule of rulesA) {
    switch (rule.id) {
      case 1: // 1は0として扱う
        if (original === 1) {
          value = 0;
        }
        break;
      case 2: // 偶数は常に負の値として扱う（判定は元の数字基準）
        if (isEven) {
          value = -Math.abs(value);
        }
        break;
      case 3: // 奇数は2倍にしてから計算する（判定は元の数字基準）
        if (original % 2 !== 0) {
          value = value * 2;
        }
        break;
      case 4: // 式の中の最小の数字だけ2倍にする（最小値の判定は元の数字基準）
        if (context.isMinInFormula) {
          value = value * 2;
        }
        break;
      case 5: // 式の中の最大の数字だけ半分にする（切り捨て、判定は元の数字基準）
        if (context.isMaxInFormula) {
          value = Math.trunc(value / 2);
        }
        break;
      default:
        break;
    }
  }
  return value;
}

// ---- 段階B: 演算子の意味変更 ----
// 各演算子記号は「元の記号」を基準に一度だけ意味が決まる。連鎖はしない。
function resolveOperator(op, ruleIds) {
  const has = (id) => ruleIds.includes(id);
  switch (op) {
    case 'sub':
      return has(6) ? 'add' : 'sub';
    case 'mul':
      return has(7) ? 'add' : 'mul';
    case 'div':
      return has(8) ? 'sub' : 'div';
    case 'add':
    default:
      return has(9) ? 'div' : 'add';
  }
}

function combine(left, effectiveOp, right) {
  switch (effectiveOp) {
    case 'add':
      return left + right;
    case 'sub':
      return left - right;
    case 'mul':
      return left * right;
    case 'div':
      if (right === 0) return DIV_BY_ZERO;
      return left / right;
    default:
      return left;
  }
}

// ---- 段階C: 結果の後処理 ----
function applyStageC(result, ruleIds) {
  const rulesC = selectedRules(ruleIds, 'C');
  if (typeof result !== 'number' || Number.isNaN(result)) return result;

  const sign = result < 0 ? -1 : 1;
  let intPart = Math.trunc(Math.abs(result));
  const fracPart = Math.abs(result) - intPart;
  let currentSign = sign;

  for (const rule of rulesC) {
    switch (rule.id) {
      case 11: // 鏡のように反転させる
        intPart = Number(String(intPart).split('').reverse().join(''));
        break;
      case 12: // 絶対値にする
        currentSign = 1;
        break;
      case 13: // 2倍にする
        intPart = intPart * 2;
        break;
      default:
        break;
    }
  }

  return currentSign * (intPart + fracPart);
}

// ---- 段階D: 表示演出 ----

const ONES = ['', 'イチ', 'ニ', 'サン', 'ヨン', 'ゴ', 'ロク', 'ナナ', 'ハチ', 'キュウ'];

function tensReading(n) {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  let str = '';
  if (tens === 1) str += 'ジュウ';
  else if (tens > 1) str += ONES[tens] + 'ジュウ';
  str += ONES[ones];
  return str;
}

const HUNDREDS_SPECIAL = { 3: 'サンビャク', 6: 'ロッピャク', 8: 'ハッピャク' };
function hundredsReading(h) {
  if (h === 0) return '';
  if (h === 1) return 'ヒャク';
  if (HUNDREDS_SPECIAL[h]) return HUNDREDS_SPECIAL[h];
  return ONES[h] + 'ヒャク';
}

const THOUSANDS_SPECIAL = { 3: 'サンゼン', 8: 'ハッセン' };
function thousandsReading(th) {
  if (th === 0) return '';
  if (th === 1) return 'セン';
  if (THOUSANDS_SPECIAL[th]) return THOUSANDS_SPECIAL[th];
  return ONES[th] + 'セン';
}

function numberToKatakanaInt(n) {
  if (n === 0) return 'ゼロ';
  if (n < 0 || n >= 10000) {
    // 想定範囲外は桁ごとの読みにフォールバックする
    return String(Math.trunc(Math.abs(n)))
      .split('')
      .map((d) => ONES[Number(d)] || 'ゼロ')
      .join('');
  }
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  const h = Math.floor(rem / 100);
  const rem2 = rem % 100;
  return thousandsReading(th) + hundredsReading(h) + tensReading(rem2);
}

// 小数第2位までの四捨五入表示（既存の formatNumber と同じ丸め方針）
function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function numberToKatakanaReading(value) {
  const abs = Math.abs(value);
  const intPart = Math.trunc(abs);
  const str = formatNumber(abs);
  const dotIdx = str.indexOf('.');
  const fracDigits = dotIdx === -1 ? '' : str.slice(dotIdx + 1);

  let reading = numberToKatakanaInt(intPart);
  if (fracDigits) {
    reading += 'テン' + [...fracDigits].map((d) => ONES[Number(d)] || 'ゼロ').join('');
  }
  return reading;
}

const HALFWIDTH_BASE = {
  ア: 'ｱ', イ: 'ｲ', ウ: 'ｳ', エ: 'ｴ', オ: 'ｵ',
  カ: 'ｶ', キ: 'ｷ', ク: 'ｸ', ケ: 'ｹ', コ: 'ｺ',
  サ: 'ｻ', シ: 'ｼ', ス: 'ｽ', セ: 'ｾ', ソ: 'ｿ',
  タ: 'ﾀ', チ: 'ﾁ', ツ: 'ﾂ', テ: 'ﾃ', ト: 'ﾄ',
  ナ: 'ﾅ', ニ: 'ﾆ', ヌ: 'ﾇ', ネ: 'ﾈ', ノ: 'ﾉ',
  ハ: 'ﾊ', ヒ: 'ﾋ', フ: 'ﾌ', ヘ: 'ﾍ', ホ: 'ﾎ',
  マ: 'ﾏ', ミ: 'ﾐ', ム: 'ﾑ', メ: 'ﾒ', モ: 'ﾓ',
  ヤ: 'ﾔ', ユ: 'ﾕ', ヨ: 'ﾖ',
  ラ: 'ﾗ', リ: 'ﾘ', ル: 'ﾙ', レ: 'ﾚ', ロ: 'ﾛ',
  ワ: 'ﾜ', ヲ: 'ｦ', ン: 'ﾝ',
  ー: 'ｰ', ッ: 'ｯ', ャ: 'ｬ', ュ: 'ｭ', ョ: 'ｮ',
};
const HALFWIDTH_VOICED = {
  ガ: 'ｶﾞ', ギ: 'ｷﾞ', グ: 'ｸﾞ', ゲ: 'ｹﾞ', ゴ: 'ｺﾞ',
  ザ: 'ｻﾞ', ジ: 'ｼﾞ', ズ: 'ｽﾞ', ゼ: 'ｾﾞ', ゾ: 'ｿﾞ',
  ダ: 'ﾀﾞ', ヂ: 'ﾁﾞ', ヅ: 'ﾂﾞ', デ: 'ﾃﾞ', ド: 'ﾄﾞ',
  バ: 'ﾊﾞ', ビ: 'ﾋﾞ', ブ: 'ﾌﾞ', ベ: 'ﾍﾞ', ボ: 'ﾎﾞ',
};
const HALFWIDTH_HANDAKU = {
  パ: 'ﾊﾟ', ピ: 'ﾋﾟ', プ: 'ﾌﾟ', ペ: 'ﾍﾟ', ポ: 'ﾎﾟ',
};

function toHalfWidthKatakana(str) {
  return str
    .split('')
    .map((ch) => HALFWIDTH_VOICED[ch] || HALFWIDTH_HANDAKU[ch] || HALFWIDTH_BASE[ch] || ch)
    .join('');
}

// 「ン」で終わる読みは、伸ばし棒を「ン」の直前に挿入する（例: サン→サーン）。
// それ以外は末尾にそのまま伸ばし棒を足す（例: ロク→ロクー）。
function elongate(reading) {
  if (reading.endsWith('ン')) {
    return reading.slice(0, -1) + 'ー' + 'ン';
  }
  return reading + 'ー';
}

function isAllTwos(value) {
  if (!Number.isInteger(value)) return false;
  const s = String(Math.trunc(Math.abs(value)));
  return s.length >= 2 && [...s].every((c) => c === '2');
}

function applyStageD(finalValue, ruleIds) {
  const has = (id) => ruleIds.includes(id);

  if (has(15) && isAllTwos(finalValue)) {
    return { display: '__CAT__', displayType: 'cat' };
  }

  if (has(14)) {
    const numStr = formatNumber(finalValue);
    const isMultipleOf3 = Number.isInteger(finalValue) && finalValue % 3 === 0;
    const containsThree = numStr.includes('3');
    if (isMultipleOf3 || containsThree) {
      const reading = numberToKatakanaReading(finalValue);
      const elongated = elongate(reading);
      const half = toHalfWidthKatakana(elongated);
      return { display: `${half}!`, displayType: 'nabeatsu' };
    }
  }

  return { display: formatNumber(finalValue), displayType: 'number' };
}

// formula: parser.parseFormula() の戻り値 { terms, ops }
// ruleIds: 親が選択中のルールID配列
export function evaluateFormula(formula, ruleIds) {
  const { terms, ops } = formula;
  const minTerm = Math.min(...terms);
  const maxTerm = Math.max(...terms);

  const transformed = terms.map((term) => {
    const isMinInFormula = term === minTerm;
    const isMaxInFormula = term === maxTerm;
    return applyStageA(term, { isMinInFormula, isMaxInFormula }, ruleIds);
  });

  const effectiveOps = ops.map((op) => resolveOperator(op, ruleIds));
  const applyTwice = ruleIds.includes(10);

  let result = transformed[0];
  for (let i = 0; i < effectiveOps.length; i += 1) {
    const right = transformed[i + 1];
    result = combine(result, effectiveOps[i], right);
    if (result === DIV_BY_ZERO) break;
    if (applyTwice) {
      result = combine(result, effectiveOps[i], right);
      if (result === DIV_BY_ZERO) break;
    }
  }

  if (result === DIV_BY_ZERO) {
    return { ok: false, error: 'DIV_BY_ZERO', display: '計算不能（÷0）', displayType: 'number' };
  }

  const finalValue = applyStageC(result, ruleIds);
  const { display, displayType } = applyStageD(finalValue, ruleIds);

  return {
    ok: true,
    value: finalValue,
    display,
    displayType,
  };
}

export const ALL_RULES = RULES;
