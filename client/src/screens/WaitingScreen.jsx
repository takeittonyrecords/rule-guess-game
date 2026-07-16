import RuleMemoList from './RuleMemoList.jsx';
import ResultDisplay from './ResultDisplay.jsx';

function memberName(gameState, id) {
  return gameState.members.find((m) => m.id === id)?.name || '?';
}

export default function WaitingScreen({ gameState, answering, role, ruleMemo, onCycleMemo }) {
  return (
    <div className="screen">
      <h2>
        <i className={`ti ${answering ? 'ti-certificate' : 'ti-flask'} heading-icon`} aria-hidden="true" />
        {answering ? '卒業判定中' : '試験問題'}
      </h2>
      {answering ? (
        <p>
          <strong>{memberName(gameState, gameState.answeringChildId)}</strong> さんが回答中です...
        </p>
      ) : (
        <p>
          今は <strong>{memberName(gameState, gameState.currentChildId)}</strong> さんの手番です。
        </p>
      )}

      <h3>これまでの式と結果</h3>
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
              <td>
                <ResultDisplay display={h.resultDisplay} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {gameState.history.length === 0 && <p className="hint">まだ誰も式を入力していません</p>}

      {role === 'child' && (
        <RuleMemoList rulesPool={gameState.rulesPool} memo={ruleMemo} onCycle={onCycleMemo} />
      )}
    </div>
  );
}
