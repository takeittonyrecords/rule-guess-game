function childName(gameState, id) {
  return gameState.members.find((m) => m.id === id)?.name || '?';
}

export default function ParentMonitor({ gameState }) {
  const selectedLabels = (gameState.selectedRuleIds || [])
    .map((id) => gameState.rulesPool.find((r) => r.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="screen">
      <h2>予測フェイズ（監視）</h2>
      <p>
        現在の手番: <strong>{childName(gameState, gameState.currentChildId)}</strong>
      </p>

      <h3>選択中のルール（{gameState.ruleCountSelected}個、他のメンバーには非公開）</h3>
      <ul className="selected-rule-list">
        {selectedLabels.map((label, idx) => (
          <li key={idx}>{label}</li>
        ))}
      </ul>

      <h3>これまでの式と結果（全員に公開中）</h3>
      <table className="history-table">
        <thead>
          <tr>
            <th>子</th>
            <th>式</th>
            <th>結果</th>
          </tr>
        </thead>
        <tbody>
          {gameState.history.map((h, idx) => (
            <tr key={idx}>
              <td>{h.childName}</td>
              <td>{h.formulaDisplay}</td>
              <td>{h.resultDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gameState.history.length === 0 && <p className="hint">まだ誰も式を入力していません</p>}
    </div>
  );
}
