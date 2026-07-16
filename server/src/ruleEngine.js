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
//    複数の段階Dルールが同時に選ばれていて、条件が重なった場合の優先順位は
//    ネコ(15) > クリリン(17, 59/593) > 名言(16, 42) > ナベアツ(14) の順。
//    （例：222はナベアツの条件も満たすがネコが優先。593はナベアツの条件も満たすが
//    クリリンが優先。42はナベアツの条件も満たすが名言が優先。）
// 8. ナベアツ風の読み上げでは、マイナス符号は読みに含めない（簡略化）。
//    小数が出た場合は「テン」のあとに小数部分の桁を1つずつ読む
//    （例：3.33 → サンテンサンサン）。整数部分は4桁ごとに区切り、万・億・兆・京の
//    単位を付けて読み上げる（例：970299 → キュウジュウナナマンニヒャクキュウジュウキュウ）。
//    ルール10（演算子を2回適用）と掛け算の組み合わせでは数十億規模まで到達しうるため、
//    この一般化が必要になった。想定を超える桁数（京を超える）の場合のみ、
//    桁ごとの読みにフォールバックする。
// 9. v2で追加: evaluateFormula は親専用の「内訳（trace）」を返す。どのルールが
//    どの数値・演算子をどう変えたかを日本語の短い文で記録した配列で、実際に
//    値が変化した場合のみ記録する（何も変わらなかったルールは記録しない）。
//    子には見せず、親の監視画面でのみ表示する想定（サーバー側でフィルタする）。

import { RULES, getRuleById } from './rules.js';

const DIV_BY_ZERO = Symbol('DIV_BY_ZERO');

const OP_SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' };

function selectedRules(ruleIds, stage) {
  return ruleIds
    .map((id) => getRuleById(id))
    .filter((r) => r && r.stage === stage)
    .sort((a, b) => a.priority - b.priority);
}

// ---- 段階A: 数値の前処理 ----
function applyStageA(term, context, ruleIds, trace, termIndex) {
  const rulesA = selectedRules(ruleIds, 'A');
  let value = term;
  const original = term;
  const isEven = original % 2 === 0;

  for (const rule of rulesA) {
    const before = value;
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
    if (value !== before && trace) {
      trace.push(`項${termIndex + 1}(${original}): ${before}→${value}（${rule.label}）`);
    }
  }
  return value;
}

// ---- 段階B: 演算子の意味変更 ----
// 各演算子記号は「元の記号」を基準に一度だけ意味が決まる。連鎖はしない。
function resolveOperator(op, ruleIds, trace, opIndex) {
  const has = (id) => ruleIds.includes(id);
  let effective = op;
  let firedRuleId = null;
  switch (op) {
    case 'sub':
      if (has(6)) {
        effective = 'add';
        firedRuleId = 6;
      }
      break;
    case 'mul':
      if (has(7)) {
        effective = 'add';
        firedRuleId = 7;
      }
      break;
    case 'div':
      if (has(8)) {
        effective = 'sub';
        firedRuleId = 8;
      }
      break;
    case 'add':
    default:
      if (has(9)) {
        effective = 'div';
        firedRuleId = 9;
      }
      break;
  }
  if (firedRuleId && trace) {
    const rule = getRuleById(firedRuleId);
    trace.push(`演算子${opIndex + 1}: ${OP_SYMBOL[op]}→${OP_SYMBOL[effective]}（${rule.label}）`);
  }
  return effective;
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
function applyStageC(result, ruleIds, trace) {
  const rulesC = selectedRules(ruleIds, 'C');
  if (typeof result !== 'number' || Number.isNaN(result)) return result;

  const sign = result < 0 ? -1 : 1;
  let intPart = Math.trunc(Math.abs(result));
  const fracPart = Math.abs(result) - intPart;
  let currentSign = sign;

  for (const rule of rulesC) {
    const beforeValue = currentSign * (intPart + fracPart);
    switch (rule.id) {
      case 11: // 鏡のように反転させる
        intPart = Number(String(intPart).split('').reverse().join(''));
        break;
      case 12: { // ぞろ目にする（結果の全部の桁を先頭の数字で揃える）
        const digits = String(intPart);
        intPart = Number(digits[0].repeat(digits.length));
        break;
      }
      case 13: // 2倍にする
        intPart = intPart * 2;
        break;
      default:
        break;
    }
    const afterValue = currentSign * (intPart + fracPart);
    if (afterValue !== beforeValue && trace) {
      trace.push(`段階C: ${formatNumber(beforeValue)}→${formatNumber(afterValue)}（${rule.label}）`);
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

// 0〜9999を正確に読む（千・百・十・一の組み立て）
function readUnder10000(n) {
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  const h = Math.floor(rem / 100);
  const rem2 = rem % 100;
  return thousandsReading(th) + hundredsReading(h) + tensReading(rem2);
}

// 4桁ごとの単位（万・億・兆・京）。この配列の範囲を超える桁数の場合のみ
// 桁ごとの読みにフォールバックする（このゲームで実際に到達しうる値は
// 兆未満のため、京まで対応しておけば十分な安全マージンがある）。
const BIG_UNITS = ['', 'マン', 'オク', 'チョウ', 'ケイ'];

function numberToKatakanaInt(n) {
  if (n === 0) return 'ゼロ';
  const abs = Math.trunc(Math.abs(n));
  if (abs < 10000) return readUnder10000(abs);

  // 4桁ずつに区切る（下の桁から順に取り出す）
  const groups = [];
  let remaining = abs;
  while (remaining > 0) {
    groups.push(remaining % 10000);
    remaining = Math.floor(remaining / 10000);
  }

  if (groups.length - 1 >= BIG_UNITS.length) {
    // 想定を超える桁数(京を超える)場合は、桁ごとの読みにフォールバックする
    return String(abs)
      .split('')
      .map((d) => ONES[Number(d)] || 'ゼロ')
      .join('');
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const groupValue = groups[i];
    if (groupValue === 0) continue;
    result += readUnder10000(groupValue) + BIG_UNITS[i];
  }
  return result;
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

  if (has(17) && (finalValue === 59 || finalValue === 593)) {
    return { display: 'クリリンのことかーっ！！！', displayType: 'kuririn' };
  }

  if (has(16) && finalValue === 42) {
    return { display: '__ANSWER42__', displayType: 'quote42' };
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
// 戻り値の trace は親専用の内訳（実際にどのルールが何を変えたかの日本語の短文配列）。
export function evaluateFormula(formula, ruleIds) {
  const { terms, ops } = formula;
  const minTerm = Math.min(...terms);
  const maxTerm = Math.max(...terms);
  const trace = [];

  const transformed = terms.map((term, idx) => {
    const isMinInFormula = term === minTerm;
    const isMaxInFormula = term === maxTerm;
    return applyStageA(term, { isMinInFormula, isMaxInFormula }, ruleIds, trace, idx);
  });

  const effectiveOps = ops.map((op, idx) => resolveOperator(op, ruleIds, trace, idx));
  const applyTwice = ruleIds.includes(10);
  if (applyTwice) {
    trace.push('ルール10「演算子は同じ数でもう一度計算する」が有効: 各演算子を2回ずつ適用');
  }

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
    return {
      ok: false,
      error: 'DIV_BY_ZERO',
      display: '計算不能（÷0）',
      displayType: 'number',
      trace,
    };
  }

  const finalValue = applyStageC(result, ruleIds, trace);
  const { display, displayType } = applyStageD(finalValue, ruleIds);

  return {
    ok: true,
    value: finalValue,
    display,
    displayType,
    trace,
  };
}

export const ALL_RULES = RULES;
