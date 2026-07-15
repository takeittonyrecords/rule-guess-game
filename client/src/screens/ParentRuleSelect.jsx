import { useState } from 'react';
import { emitAsync } from '../socket.js';

export default function ParentRuleSelect({ gameState, roomCode }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otherMembers = gameState.members.filter((m) => m.id !== gameState.currentParentId);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleStart() {
    setError('');
    if (selected.length < 2 || selected.length > 3) {
      setError('ルールは2〜3個選んでください');
      return;
    }
    setSubmitting(true);
    const res = await emitAsync('parent:selectRules', { roomCode, ruleIds: selected });
    setSubmitting(false);
    if (!res?.ok) {
      setError(res?.error || '開始に失敗しました');
    }
  }

  return (
    <div className="screen">
      <h2>ルール選択（部屋コード: {gameState.code}）</h2>
      <p>あなたが今回の親です。他のメンバー: {otherMembers.map((m) => m.name).join('、') || '(まだいません)'}</p>
      <p>プールから2〜3個のルールを選んでください。選んだルールは他のメンバーには見えません。</p>

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
      <button disabled={submitting || otherMembers.length === 0} onClick={handleStart}>
        このルールでゲームを開始する
      </button>
      {otherMembers.length === 0 && <p className="hint">他のメンバーの参加を待っています</p>}
    </div>
  );
}
