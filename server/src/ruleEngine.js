// ルール適用エンジン
// 仕様書 5章・5-1節・5-2節 に対応する実装。
//
// 設計上の前提（仕様書に明記のない細部について、実装のためにこちらで決めた挙動。
// 要すり合わせなら後で調整してください）:
// 1. 演算子の優先順位は導入しない。段階Bのルールが選ばれていない場合、式は単純に
//    左から右へ順番に計算する（× ÷ を先に計算する、という一般的な優先順位は使わない）。
//    ルール10「右から左に処理する」は、この左→右の基本順序を反転させるという設計。
// 2. 「1は足し算されるときに限り1として扱う」の判定は、その数字の左右いずれかの
//    演算子記号が元の式で「+」であるかどうかで決める（例: 1+5 の 1 は対象、1×5 の 1 は対象外）。
// 3. ルール適用によって（入力時点では0除算でなかったのに）割る数が0になってしまった場合は、
//    「計算不能（÷0）」という特殊な結果として扱う（手番は通常通り消費する）。
// 4. 段階Cの桁操作系ルール（鏡反転・桁合計・一の位十の位入れ替え）は、結果の整数部分の
//    絶対値に対して適用し、符号は別途保持する。小数が出た場合は整数部分のみ桁操作の対象とし、
//    小数部分はそのまま保持する。

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
  const isAddedContext = context.leftOp === 'add' || context.rightOp === 'add';

  for (const rule of rulesA) {
    switch (rule.id) {
      case 2: // 1は足し算されるときに限り1として扱う（常に最優先固定）
        if (original === 1 && isAddedContext) {
          value = 1;
        }
        break;
      case 1: // 1は0として扱う
        if (original === 1) {
          const rule2Selected = ruleIds.includes(2);
          const protectedByRule2 = rule2Selected && isAddedContext;
          if (!protectedByRule2) {
            value = 0;
          }
        }
        break;
      case 3: // 偶数は常に負の値として扱う（判定は元の数字基準）
        if (isEven) {
          value = -Math.abs(value);
        }
        break;
      case 6: // 式の中の最大の数字だけ2倍にしてから計算する（最大値の判定は元の数字基準）
        if (context.isMaxInFormula) {
          value = value * 2;
        }
        break;
      case 4: // 奇数は2倍にしてから計算する（判定は元の数字基準）
        if (original % 2 !== 0) {
          value = value * 2;
        }
        break;
      case 5: // 5の倍数は0として扱う（判定は元の数字基準）
        if (original % 5 === 0) {
          value = 0;
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
      return has(7) ? 'sub-as-add' : 'sub';
    case 'mul':
      return has(8) ? 'mul-as-add' : 'mul';
    case 'div':
      return has(9) ? 'div-as-mul' : 'div';
    case 'add':
    default:
      return 'add';
  }
}

function combine(left, effectiveOp, right) {
  switch (effectiveOp) {
    case 'add':
      return left + right;
    case 'sub':
      return left - right;
    case 'sub-as-add':
      return left + -right;
    case 'mul':
      return left * right;
    case 'mul-as-add':
      return left + right;
    case 'div':
      if (right === 0) return DIV_BY_ZERO;
      return left / right;
    case 'div-as-mul':
      return left * right;
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
      case 12: // 2桁以上なら各桁を合計する
        if (intPart >= 10) {
          intPart = String(intPart)
            .split('')
            .reduce((sum, d) => sum + Number(d), 0);
        }
        break;
      case 14: // 一の位と十の位を入れ替える
        if (intPart >= 10) {
          const s = String(intPart);
          const tens = s.slice(0, -1);
          const ones = s.slice(-1);
          intPart = Number(ones + tens);
        }
        break;
      case 11: // 鏡のように反転させる
        intPart = Number(String(intPart).split('').reverse().join(''));
        break;
      case 13: // 絶対値にする
        currentSign = 1;
        break;
      case 15: // 2倍にする
        intPart = intPart * 2;
        break;
      default:
        break;
    }
  }

  return currentSign * (intPart + fracPart);
}

// formula: parser.parseFormula() の戻り値 { terms, ops }
// ruleIds: 親が選択中のルールID配列
export function evaluateFormula(formula, ruleIds) {
  const { terms, ops } = formula;
  const maxTerm = Math.max(...terms);

  const transformed = terms.map((term, idx) => {
    const leftOp = idx > 0 ? ops[idx - 1] : undefined;
    const rightOp = idx < ops.length ? ops[idx] : undefined;
    const isMaxInFormula = term === maxTerm;
    return applyStageA(term, { leftOp, rightOp, isMaxInFormula }, ruleIds);
  });

  const effectiveOps = ops.map((op) => resolveOperator(op, ruleIds));
  const rightToLeft = ruleIds.includes(10);

  let result;
  if (!rightToLeft) {
    result = transformed[0];
    for (let i = 0; i < effectiveOps.length; i += 1) {
      result = combine(result, effectiveOps[i], transformed[i + 1]);
      if (result === DIV_BY_ZERO) break;
    }
  } else {
    result = transformed[transformed.length - 1];
    for (let i = effectiveOps.length - 1; i >= 0; i -= 1) {
      result = combine(transformed[i], effectiveOps[i], result);
      if (result === DIV_BY_ZERO) break;
    }
  }

  if (result === DIV_BY_ZERO) {
    return { ok: false, error: 'DIV_BY_ZERO', display: '計算不能（÷0）' };
  }

  const finalValue = applyStageC(result, ruleIds);

  return {
    ok: true,
    value: finalValue,
    display: formatNumber(finalValue),
  };
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export const ALL_RULES = RULES;
