// 子が予測フェイズ中に使う、ルールごとの推理メモ（？/〇/×）。
// サーバーには送らない、この端末だけのローカルなメモ。

export const MEMO_SYMBOLS = [null, '？', '〇', '×'];

export function nextMemoSymbol(current) {
  const idx = MEMO_SYMBOLS.indexOf(current || null);
  return MEMO_SYMBOLS[(idx + 1) % MEMO_SYMBOLS.length];
}

const SYMBOL_COLOR = {
  '？': '#b8860b',
  '〇': '#1e8449',
  '×': '#c0392b',
};

export default function RuleMemoList({ rulesPool, memo, onCycle }) {
  return (
    <div className="rule-memo">
      <h3>ルール一覧（自分用の推理メモ）</h3>
      <p className="hint">
        右側の記号をクリックすると 空欄 → ？ → 〇 → × → 空欄 の順で切り替わります（自分にしか見えません）。
      </p>
      <ul className="rule-memo-list">
        {rulesPool.map((r) => {
          const symbol = memo[r.id] || null;
          return (
            <li key={r.id} className="rule-memo-item">
              <span className="rule-memo-label">{r.label}</span>
              <button
                type="button"
                className="rule-memo-toggle"
                style={{ color: symbol ? SYMBOL_COLOR[symbol] : '#999' }}
                onClick={() => onCycle(r.id)}
                aria-label="推理メモを切り替える"
              >
                {symbol || '－'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
