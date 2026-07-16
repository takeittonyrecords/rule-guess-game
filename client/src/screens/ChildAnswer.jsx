import { useState } from 'react';
import { emitAsync } from '../socket.js';
import RuleCard from './RuleCard.jsx';

export default function ChildAnswer({ gameState, roomCode, onResult }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setError('');
    if (selected.length < 2) {
      setError('ルールを2つ以上選んでください');
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
    <div className="screen answer-sheet">
      <div className="answer-sheet-header">
        <span className="answer-sheet-title">解答用紙</span>
        <span className="answer-sheet-hint">選択式・2つ以上</span>
      </div>

      <div className="rule-card-grid">
        {gameState.rulesPool.map((r, idx) => (
          <RuleCard
            key={r.id}
            rule={r}
            checked={selected.includes(r.id)}
            onToggle={() => toggle(r.id)}
            questionNumber={idx + 1}
            roundCheckbox
          />
        ))}
      </div>

      <p>選択中: {selected.length}個</p>
      {error && <p className="error-text">{error}</p>}
      <button disabled={busy} onClick={handleSubmit}>
        <i className="ti ti-check" aria-hidden="true" />
        解答する
      </button>
    </div>
  );
}
