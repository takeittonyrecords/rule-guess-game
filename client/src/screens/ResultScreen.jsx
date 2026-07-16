import JudgementStamp from './JudgementStamp.jsx';

export default function ResultScreen({ gameState, amHost, roomCode, onResetToLobby }) {
  const { lastResult, rulesPool } = gameState;
  const isDropout = lastResult?.judgement === 'DROPOUT';
  const correctLabels = (lastResult?.correctRuleIds || [])
    .map((id) => rulesPool.find((r) => r.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="screen center">
      <h2>
        <i className={`ti ${isDropout ? 'ti-mood-sad' : 'ti-confetti'} heading-icon`} aria-hidden="true" />
        {isDropout ? '中退...' : '卒業！'}
      </h2>
      <JudgementStamp judgement={lastResult?.judgement || 'GRADUATE'} />
      {isDropout ? (
        <p>
          <strong>{lastResult?.clearedChildName}</strong> さんはあきらめてしまった…
        </p>
      ) : (
        <p>
          <strong>{lastResult?.clearedChildName}</strong> さんが正解しました。
        </p>
      )}
      <h3>正解ルール</h3>
      <ul>
        {correctLabels.map((label, idx) => (
          <li key={idx}>{label}</li>
        ))}
      </ul>

      {amHost && (
        <button onClick={onResetToLobby}>
          <i className="ti ti-refresh" aria-hidden="true" />
          ロビーに戻って次のラウンドを始める
        </button>
      )}
      {!amHost && <p className="hint">ホストが次のラウンドを始めるのを待っています...</p>}
    </div>
  );
}
