import { useState } from 'react';
import { emitAsync } from '../socket.js';
import { stageMeta } from '../ruleTheme.js';

export default function ChildAnswer({ gameState, roomCode, onResult }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setError('');
    if (selected.length < 1) {
      setError('ルールを1つ以上選んでください');
      return;
    }
    setBusy(true);
    const res = await emitAsync('child:submitAnswer', { roomCode, ruleIds: selected });
    setBusy(false);
    if (!res?.ok) {
      setError(res?.error || '送信に失敗しました');
      return;
    }
    onResult(res.judgement);
  }

  return (
    <div className="screen">
      <div className="answer-sheet-header">
        <span className="answer-sheet-title">解答用紙</span>
        <span className="answer-sheet-hint">選択式・1つ以上</span>
      </div>

      <ul className="answer-rule-list">
        {gameState.rulesPool.map((r) => {
          const checked = selected.includes(r.id);
          const meta = stageMeta(r.stage);
          return (
            <li key={r.id} className="answer-rule-item">
              <label className="answer-rule-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(r.id)}
                  className="square-checkbox"
                />
                <span
                  className="answer-rule-badge"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  <i className={`ti ${meta.icon}`} aria-hidden="true" />
                </span>
                <span className="answer-rule-label">{r.label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <p>選択中: {selected.length}個</p>
      {error && <p className="error-text">{error}</p>}
      <button disabled={busy} onClick={handleSubmit}>
        <i className="ti ti-check" aria-hidden="true" />
        解答する
      </button>
    </div>
  );
}
