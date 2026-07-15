// 簡易テスト（仕様書 5-2節の例に基づく確認）。node src/ruleEngine.test.js で実行。
import { parseFormula } from './parser.js';
import { evaluateFormula } from './ruleEngine.js';

let pass = 0;
let fail = 0;

function check(label, formulaStr, ruleIds, expected) {
  const formula = parseFormula(formulaStr);
  const result = evaluateFormula(formula, ruleIds);
  const actual = result.ok ? result.value : result.display;
  const ok = actual === expected;
  if (ok) {
    pass += 1;
    console.log(`OK   ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual} (expected ${expected})`);
  }
}

// 5-2節 例1: ルール1×ルール2
check('rule1x2-a', '1+5', [1, 2], 6); // 1は加算対象なのでルール2適用、1のまま
check('rule1x2-b', '1*5', [1, 2], 0); // 1は加算対象でないのでルール1適用、0になる

// 5-2節 例2: ルール4×ルール5（4は偶数なのでルール4の影響を受けず、5だけが対象になる）
check('rule4x5-both', '5+4', [4, 5], 4); // 5->10->0(5の倍数なので)、0+4=4
check('rule4x5-only4', '5+4', [4], 14); // 5->10、10+4=14

// 5-2節 例3: ルール3×ルール6
check('rule3x6', '4+9', [3, 6], 14); // 4は偶数->-4、9は最大値->18、-4+18=14

// ルールなしの基本動作(左から右)
check('plain-1', '2+3*4', [], 20); // (2+3)=5, 5x4=20 (左から右、優先順位なし)

// ルール10: 右から左
check('rule10', '2+3*4', [10], 14); // 3x4=12, 2+12=14

// 段階B: 掛け算を足し算に置換
check('rule8', '2*3', [8], 5); // 2+3=5

// 段階B: 割り算を掛け算に置換
check('rule9', '10/5', [9], 50); // 10x5=50

// 段階C: 桁合計
check('rule12', '90+5', [12], 14); // 95 -> 9+5=14

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
