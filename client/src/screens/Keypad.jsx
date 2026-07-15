// v2で追加: 計算式入力用のソフトウェアキーボード（仕様書v2 4-2節）。
// 電卓アプリに近い4x4グリッド。数字は7-8-9/4-5-6/1-2-3/0の並び、
// 演算子(÷×−＋)は右端の列に縦に配置。左下にクリア、その隣に削除ボタン。
//
// 注意: ボタンの見た目は「−」「＋」（全角/数学記号）だが、実際に入力欄へ挿入する
// 文字はサーバー側パーサー(parser.js)が受け付ける半角の「-」「+」にしている。
// ×と÷はパーサーがそのまま受け付けるのでボタン表示と同じ文字を挿入する。
const OPS = [
  { label: '÷', char: '÷' },
  { label: '×', char: '×' },
  { label: '−', char: '-' },
  { label: '＋', char: '+' },
];

export default function Keypad({ value, onChange }) {
  function press(char) {
    onChange(value + char);
  }
  function backspace() {
    onChange(value.slice(0, -1));
  }
  function clear() {
    onChange('');
  }

  return (
    <div className="keypad">
      <div className="keypad-display">{value || ' '}</div>
      <div className="keypad-grid">
        <button type="button" onClick={() => press('7')}>7</button>
        <button type="button" onClick={() => press('8')}>8</button>
        <button type="button" onClick={() => press('9')}>9</button>
        <button type="button" className="keypad-op" onClick={() => press(OPS[0].char)}>{OPS[0].label}</button>

        <button type="button" onClick={() => press('4')}>4</button>
        <button type="button" onClick={() => press('5')}>5</button>
        <button type="button" onClick={() => press('6')}>6</button>
        <button type="button" className="keypad-op" onClick={() => press(OPS[1].char)}>{OPS[1].label}</button>

        <button type="button" onClick={() => press('1')}>1</button>
        <button type="button" onClick={() => press('2')}>2</button>
        <button type="button" onClick={() => press('3')}>3</button>
        <button type="button" className="keypad-op" onClick={() => press(OPS[2].char)}>{OPS[2].label}</button>

        <button type="button" className="keypad-clear" onClick={clear}>クリア</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" onClick={backspace} aria-label="1文字削除">⌫</button>
        <button type="button" className="keypad-op" onClick={() => press(OPS[3].char)}>{OPS[3].label}</button>
      </div>
    </div>
  );
}
