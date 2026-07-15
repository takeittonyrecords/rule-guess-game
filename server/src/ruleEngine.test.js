// 簡易テスト（仕様書v2 3章の例に基づく確認）。node src/ruleEngine.test.js で実行。
import { parseFormula } from './parser.js';
import { evaluateFormula } from './ruleEngine.js';

let pass = 0;
let fail = 0;

function checkValue(label, formulaStr, ruleIds, expected) {
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

function checkDisplay(label, formulaStr, ruleIds, expected) {
  const formula = parseFormula(formulaStr);
  const result = evaluateFormula(formula, ruleIds);
  const actual = result.display;
  const ok = actual === expected;
  if (ok) {
    pass += 1;
    console.log(`OK   ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual} (expected ${expected})`);
  }
}

// 段階A
checkValue('rule1', '1+5', [1], 5); // 1は0になる、0+5=5
checkValue('rule2', '4+5', [2], 1); // 4は偶数なので-4、-4+5=1
checkValue('rule3-double-odd', '3+4', [3], 10); // 3は奇数なので2倍(6)、4はそのまま、6+4=10
checkValue('rule4-min', '3+9', [4], 15); // 3が最小なので2倍(6)、6+9=15
checkValue('rule5-max', '3+9', [5], 7); // 9が最大なので半分切り捨て(4)、3+4=7
checkValue('rule4x5-tie', '5+5', [4, 5], 10); // 5と5で最小/最大タイ、2倍(10)->半分(5)、5+5=10

// 段階B
checkValue('rule6-sub-to-add', '5-3', [6], 8); // 符号反転せず単純に置換: 5+3=8
checkValue('rule7-mul-to-add', '2*3', [7], 5); // 2+3=5
checkValue('rule8-div-to-sub', '10/2', [8], 8); // 10-2=8
checkValue('rule9-add-to-div', '10+2', [9], 5); // 10/2=5
checkValue('rule10-twice-add', '3+4', [10], 11); // 3+4+4=11
checkValue('rule10-twice-div', '10/2', [10], 2.5); // 10/2/2=2.5

// ルールなしの基本動作（左から右、優先順位なし）
checkValue('plain-left-to-right', '2+3*4', [], 20); // (2+3)=5, 5*4=20

// 段階C
checkValue('rule11-mirror', '99+24', [11], 321); // 123 -> 321
checkValue('rule12-abs', '3-10', [12], 7); // -7 -> 7
checkValue('rule13-double', '8+0', [13], 16); // 8 -> 16

// 段階D
checkDisplay('rule14-six', '6+0', [14], 'ﾛｸｰ!');
checkDisplay('rule14-three', '3+0', [14], 'ｻｰﾝ!');
checkDisplay('rule14-thirteen', '13+0', [14], 'ｼﾞｭｳｻｰﾝ!');
checkDisplay('rule15-cat', '99+99+24', [15], '__CAT__'); // 222はすべて2の並び
checkDisplay('rule14x15-cat-wins', '99+99+24', [14, 15], '__CAT__'); // 222は3の倍数でもあるが猫が優先

// 0除算（ルール適用によって発生するケース）
checkDisplay('div-by-zero-via-rule9', '5+0', [9], '計算不能（÷0）'); // 5÷0

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
