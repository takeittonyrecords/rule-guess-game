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

// 表示がランダムな候補のいずれかであることだけを確認する
function checkDisplayIn(label, formulaStr, ruleIds, candidates) {
  const formula = parseFormula(formulaStr);
  const result = evaluateFormula(formula, ruleIds);
  const actual = result.display;
  const ok = candidates.includes(actual);
  if (ok) {
    pass += 1;
    console.log(`OK   ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}: ${formulaStr} [rules ${ruleIds}] => ${actual} (expected one of ${candidates})`);
  }
}

// 段階A
checkValue('rule1', '1+5', [1], 5); // 1は0になる、0+5=5
checkValue('rule2', '4+5', [2], 1); // 4は偶数なので-4、-4+5=1
checkValue('rule3-double-odd', '3+4', [3], 10); // 3は奇数なので2倍(6)、4はそのまま、6+4=10
checkValue('rule4-min', '3+9', [4], 15); // 3が最小なので2倍(6)、6+9=15
checkValue('rule5-max', '3+9', [5], 7); // 9が最大なので半分切り捨て(4)、3+4=7
checkValue('rule4x5-tie', '5+5', [4, 5], 10); // 5と5で最小/最大タイ、2倍(10)->半分(5)、5+5=10

checkValue('rule18-even-plus1', '4+9', [18], 14); // 4は偶数なので+1(5)、5+9=14
checkValue('rule19-odd-minus1', '3+4', [19], 6); // 3は奇数なので-1(2)、4は偶数なので変化なし、2+4=6
checkValue('rule1x19-one-becomes-minus1', '1+8', [1, 19], 7); // 1は0(ルール1)、さらに元が奇数なので-1(ルール19)、-1+8=7
checkValue('rule2x18-even-stack', '4+9', [2, 18], 6); // 4は偶数なので-4(ルール2)、さらに+1(ルール18)、-3+9=6
checkValue('rule3x19-odd-stack', '3+4', [3, 19], 9); // 3は奇数なので2倍(6)、さらに-1(5)。4は偶数なので変化なし。5+4=9

// 段階B
checkValue('rule6-sub-to-mul', '5-3', [6], 15); // 引き算は掛け算として扱う: 5*3=15
checkValue('rule7-mul-to-add', '2*3', [7], 5); // 2+3=5
checkValue('rule8-div-to-sub', '10/2', [8], 8); // 10-2=8
checkValue('rule9-add-to-div', '10+2', [9], 5); // 10/2=5
checkValue('rule10-twice-add', '3+4', [10], 11); // 3+4+4=11
checkValue('rule10-twice-div', '10/2', [10], 2.5); // 10/2/2=2.5

// ルールなしの基本動作（左から右、優先順位なし）
checkValue('plain-left-to-right', '2+3*4', [], 20); // (2+3)=5, 5*4=20

// 段階C
checkValue('rule11-mirror', '99+24', [11], 321); // 123 -> 321
checkValue('rule12-repdigit-2digit', '17+0', [12], 11); // 17 -> 11（先頭の1で全桁を揃える）
checkValue('rule12-repdigit-3digit', '99+99', [12], 111); // 198 -> 111（先頭の1で全桁を揃える）
checkValue('rule12-repdigit-negative', '3-99', [12], -99); // -96 -> -99（符号は保持したまま桁だけ揃える）
checkValue('rule13-double', '8+0', [13], 16); // 8 -> 16
checkValue('rule21-triple', '3+5', [21], 24); // 8 -> 24
checkValue('rule22-half', '3+6', [22], 4); // 9 -> 4（切り捨て）

// 段階D
checkDisplay('rule14-six', '6+0', [14], 'ﾛｸｰ!');
checkDisplay('rule14-three', '3+0', [14], 'ｻｰﾝ!');
checkDisplay('rule14-thirteen', '13+0', [14], 'ｼﾞｭｳｻｰﾝ!');
checkDisplay('rule15-cat', '99+99+24', [15], '__CAT__'); // 222はすべて2の並び
checkDisplay('rule14x15-cat-wins', '99+99+24', [14, 15], '__CAT__'); // 222は3の倍数でもあるが猫が優先
checkDisplay('rule14-large-man', '99*99*99', [14], 'ｷｭｳｼﾞｭｳﾅﾅﾏﾝﾆﾋｬｸｷｭｳｼﾞｭｳｷｭｳｰ!'); // 970299（万の位の読み上げ確認）
checkDisplay(
  'rule14-large-oku',
  '99*99*99',
  [10, 14],
  'ｷｭｳｼﾞｭｳｺﾞｵｸｷｭｳﾋｬｸｷｭｳｼﾞｭｳﾏﾝﾖﾝﾋｬｸｷｭｳｼﾞｭｳｷｭｳｰ!',
); // ルール10で99*99*99*99=9,509,900,499（億の位まで正しく読めることの確認）

checkDisplay('rule16-answer42', '40+2', [16], '__ANSWER42__'); // 42のとき専用マーカー
checkDisplay('rule16x14-answer42-wins', '40+2', [14, 16], '__ANSWER42__'); // 42は3の倍数でもあるが名言ルールが優先
checkDisplay('rule17-kuririn-59', '50+9', [17], 'クリリンのことかーっ！！！');
checkDisplay('rule17-kuririn-593', '99*5+98', [17], 'クリリンのことかーっ！！！'); // 99*5+98=593
checkDisplay(
  'rule17x14-kuririn-wins',
  '99*5+98',
  [14, 17],
  'クリリンのことかーっ！！！',
); // 593は「3」を含むためナベアツの条件も満たすが、クリリンが優先

// ルール23（班長: 11/111/1111）
const HANCHOU_CANDIDATES = [
  '「ノーカン！ノーカン！ノーカン！」',
  '「いろいろいろいろ…！　しようと思ってたのに……！　くうう～～っ……！」',
  '「へただなあ、カイジ君。へたっぴさ」',
];
checkDisplayIn('rule23-hanchou-11', '5+6', [23], HANCHOU_CANDIDATES); // 11
checkDisplayIn('rule23-hanchou-111', '99+12', [23], HANCHOU_CANDIDATES); // 111
checkDisplayIn('rule23x14-hanchou-wins', '99+12', [14, 23], HANCHOU_CANDIDATES); // 111は3の倍数でもあるが班長が優先
checkDisplayIn('rule23x20-hanchou-wins', '99+12', [20, 23], HANCHOU_CANDIDATES); // 111は100超えでもあるが班長が優先

// ルール20（3歳児: 100超え）
const TODDLER_CANDIDATES = [
  '「ぼく３さいだからむずかしいことはわかりません」',
  '「もうなにもかんがえたくありません。３さいなので」',
  '「ばぶー！　ばぶー！　ばぶー！　ばぶー……」',
  '「こんなけいさんとかしたくないんです、３さいですから」',
];
checkDisplayIn('rule20-toddler', '90+15', [20], TODDLER_CANDIDATES); // 105
checkDisplay('rule20x14-nabeatsu-wins', '99+3', [14, 20], 'ﾋｬｸﾆｰ!'); // 102は3の倍数でもあり100超えでもあるが、アホが優先

// 0除算（ルール適用によって発生するケース）
checkDisplay('div-by-zero-via-rule9', '5+0', [9], '計算不能（÷0）'); // 5÷0

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
