import { useState } from 'react';
import { emitAsync } from '../socket.js';
import RuleCard from './RuleCard.jsx';

export default function ParentRuleSelect({ gameState, roomCode }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // CPUは子になれないため、人間のメンバーだけを「他のメンバー」として数える。
  const otherMembers = gameState.members.filter(
    (m) => m.id !== gameState.currentParentId && !m.isCPU,
  );

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleStart() {
    setError('');
    if (selected.length < 1 || selected.length > 5) {
      setError('ルールは1〜5個選んでください');
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
      <h2>
        <i className="ti ti-clipboard-list heading-icon" aria-hidden="true" />
        試験問題作成中（部屋コード: {gameState.code}）
      </h2>
      <p>あなたが今回の親です。他のメンバー: {otherMembers.map((m) => m.name).join('、') || '(まだいません)'}</p>
      <p>このリストから1〜5個のルールを選んでください。選んだルールは他のメンバーには見えません。</p>

      <div className="rule-card-grid">
        {gameState.rulesPool.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            checked={selected.includes(r.id)}
            onToggle={() => toggle(r.id)}
          />
        ))}
      </div>

      <p>選択中: {selected.length}個</p>
      {error && <p className="error-text">{error}</p>}
      <button disabled={submitting || otherMembers.length === 0} onClick={handleStart}>
        <i className="ti ti-wand" aria-hidden="true" />
        このルールでゲームを開始する
      </button>
      {otherMembers.length === 0 && <p className="hint">他のメンバーの参加を待っています</p>}
    </div>
  );
}
