export default function ResultScreen({ gameState, amHost, onResetToLobby }) {
  const { lastResult, rulesPool } = gameState;
  const correctLabels = (lastResult?.correctRuleIds || [])
    .map((id) => rulesPool.find((r) => r.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="screen center">
      <h2>クリア！</h2>
      <p>
        <strong>{lastResult?.clearedChildName}</strong> さんが正解しました。
      </p>
      <h3>正解ルール</h3>
      <ul>
        {correctLabels.map((label, idx) => (
          <li key={idx}>{label}</li>
        ))}
      </ul>

      {amHost && (
        <button onClick={onResetToLobby}>ロビーに戻って次のラウンドを始める</button>
      )}
      {!amHost && <p className="hint">ホストが次のラウンドを始めるのを待っています...</p>}
    </div>
  );
}
