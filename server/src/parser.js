// 子が入力する計算式のパーサー
// 仕様: 0〜99の整数、項数2〜3、使える記号は数字と + - × ÷ (* / も許容し正規化)のみ、括弧なし

const OP_NORMALIZE = {
  '+': 'add',
  '-': 'sub',
  '×': 'mul',
  '*': 'mul',
  '÷': 'div',
  '/': 'div',
};

export class FormulaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormulaError';
  }
}

// 入力文字列を { terms: number[], ops: ('add'|'sub'|'mul'|'div')[] } にパースする
export function parseFormula(raw) {
  if (typeof raw !== 'string') {
    throw new FormulaError('式は文字列で入力してください');
  }
  const input = raw.trim().replace(/\s+/g, '');
  if (input.length === 0) {
    throw new FormulaError('式が空です');
  }

  // 許可文字チェック（数字と四則演算記号のみ、括弧不可）
  const allowedCharsRegex = /^[0-9+\-×*÷/]+$/;
  if (!allowedCharsRegex.test(input)) {
    throw new FormulaError('使用できるのは数字と + − × ÷ のみです（括弧は使えません）');
  }

  // トークナイズ: 数字と演算子を交互に取り出す
  const tokens = [];
  let i = 0;
  let expectNumber = true;
  while (i < input.length) {
    if (expectNumber) {
      const match = input.slice(i).match(/^\d+/);
      if (!match) {
        throw new FormulaError('数字の位置に演算子があります。式の形式を確認してください');
      }
      tokens.push({ type: 'num', value: match[0] });
      i += match[0].length;
      expectNumber = false;
    } else {
      const ch = input[i];
      if (!(ch in OP_NORMALIZE)) {
        throw new FormulaError(`使用できない記号です: ${ch}`);
      }
      tokens.push({ type: 'op', value: OP_NORMALIZE[ch] });
      i += 1;
      expectNumber = true;
    }
  }

  if (expectNumber) {
    // 最後が演算子で終わっている(数字待ちのまま終端)
    throw new FormulaError('式が演算子で終わっています');
  }

  const terms = tokens.filter((t) => t.type === 'num').map((t) => Number(t.value));
  const ops = tokens.filter((t) => t.type === 'op').map((t) => t.value);

  if (terms.length < 2 || terms.length > 3) {
    throw new FormulaError('項数は2〜3個にしてください（例: 12+7-3）');
  }
  if (ops.length !== terms.length - 1) {
    throw new FormulaError('式の形式が正しくありません');
  }
  for (const t of terms) {
    if (!Number.isInteger(t) || t < 0 || t > 99) {
      throw new FormulaError('数字は0〜99の整数にしてください');
    }
  }
  // 元の入力そのものに0除算が含まれる場合は送信不可（仕様書 4-2）
  for (let idx = 0; idx < ops.length; idx += 1) {
    if (ops[idx] === 'div' && terms[idx + 1] === 0) {
      throw new FormulaError('0で割る式は入力できません');
    }
  }

  return { terms, ops, display: input };
}
