import { useState } from 'react';
import { emitAsync } from '../socket.js';

const JUDGEMENT_LABEL = {
  CLEAR: 'クリア！',
  C: 'C判定（ルールの数だけ合っています）',
  B: 'B判定（正解ルールを1つ以上含んでいます）',
  INCORRECT: '不正解',
};

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
    <div className="screen">
      <h2>回答フェイズ</h2>
      <p>適用されていると思うルールを2つ以上選んでください。</p>

      <ul className="rule-list">
        {gameState.rulesPool.map((r) => (
          <li key={r.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={() => toggle(r.id)}
              />
              {r.label}
            </label>
          </li>
        ))}
      </ul>

      <p>選択中: {selected.length}個</p>
      {error && <p className="error-text">{error}</p>}
      <button disabled={busy} onClick={handleSubmit}>
        この内容で回答する
      </button>
    </div>
  );
}

export { JUDGEMENT_LABEL };
