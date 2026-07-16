import JudgementStamp from './JudgementStamp.jsx';
import ResultDisplay from './ResultDisplay.jsx';

function HistoryTable({ history }) {
  return (
    <>
      <h3>このラウンドの式と結果（内訳つき）</h3>
      <table className="history-table">
        <thead>
          <tr>
            <th>子</th>
            <th>式</th>
            <th>結果</th>
            <th>内訳</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, idx) => (
            <tr key={idx}>
              <td>{h.childName}</td>
              <td>{h.formulaDisplay}</td>
              <td>
                <ResultDisplay display={h.resultDisplay} />
              </td>
              <td className="trace-cell">
                {h.trace && h.trace.length > 0 ? (
                  <ul className="trace-list">
                    {h.trace.map((line, tIdx) => (
                      <li key={tIdx}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="hint">ルールの影響なし</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {history.length === 0 && <p className="hint">まだ誰も式を入力していませんでした</p>}
    </>
  );
}

export default function ResultScreen({ gameState, amHost, roomCode, onResetToLobby }) {
  const { lastResult, rulesPool, history } = gameState;
  const isClosed = lastResult?.judgement === 'CLOSED';
  const isGraduate = lastResult?.judgement === 'GRADUATE';
  const correctLabels = (lastResult?.correctRuleIds || [])
    .map((id) => rulesPool.find((r) => r.id === id)?.label)
    .filter(Boolean);

  // lastResult がまだ届いていない(または想定外の値)場合は、
  // 「卒業」表示をデフォルトにせず、安全に何も出さない（一瞬の遷移中の表示ずれ対策）。
  if (!isClosed && !isGraduate) {
    return (
      <div className="screen center">
        <p className="hint">結果を読み込んでいます...</p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2>
            <i className="ti ti-alert-triangle heading-icon" aria-hidden="true" />
            廃校
          </h2>
          <JudgementStamp judgement="CLOSED" />
        </div>

        <h3>最初に選ばれていたルール</h3>
        <ul className="selected-rule-list">
          {correctLabels.map((label, idx) => (
            <li key={idx}>{label}</li>
          ))}
        </ul>

        <HistoryTable history={history} />

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {amHost && (
            <button onClick={onResetToLobby}>
              <i className="ti ti-refresh" aria-hidden="true" />
              ロビーに戻る
            </button>
          )}
          {!amHost && <p className="hint">ホストの操作を待っています</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2>
          <i className="ti ti-confetti heading-icon" aria-hidden="true" />
          卒業！
        </h2>
        <JudgementStamp judgement="GRADUATE" />
        <p>
          <strong>{lastResult?.clearedChildName}</strong> さんが正解しました。
        </p>
        <h3>正解ルール</h3>
        <ul>
          {correctLabels.map((label, idx) => (
            <li key={idx}>{label}</li>
          ))}
        </ul>
      </div>

      <HistoryTable history={history} />

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        {amHost && (
          <button onClick={onResetToLobby}>
            <i className="ti ti-refresh" aria-hidden="true" />
            ロビーに戻って次のラウンドを始める
          </button>
        )}
        {!amHost && <p className="hint">ホストが次のラウンドを始めるのを待っています...</p>}
      </div>
    </div>
  );
}
