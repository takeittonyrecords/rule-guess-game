import { useState } from 'react';
import { emitAsync } from '../socket.js';
import RuleMemoList from './RuleMemoList.jsx';
import ResultDisplay from './ResultDisplay.jsx';
import Keypad from './Keypad.jsx';

export default function ChildPredict({ gameState, roomCode, ruleMemo, onCycleMemo }) {
  const [formula, setFormula] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError('');
    setBusy(true);
    const res = await emitAsync('child:submitFormula', { roomCode, formula });
    setBusy(false);
    if (!res?.ok) {
      setError(res?.error || '送信に失敗しました');
      return;
    }
    setLastResult(res.resultDisplay);
    setSubmitted(true);
  }

  async function handleEndTurn(action) {
    setBusy(true);
    await emitAsync('child:endTurn', { roomCode, action });
    setBusy(false);
  }

  return (
    <div className="screen">
      <h2>予測フェイズ（あなたの手番）</h2>

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

      {!submitted && (
        <div className="stack">
          <p className="hint">計算式（0〜99の整数、2〜3項）をキーパッドで入力してください</p>
          <Keypad value={formula} onChange={setFormula} />
          {error && <p className="error-text">{error}</p>}
          <button disabled={busy || !formula} onClick={handleSubmit}>
            送信する
          </button>
        </div>
      )}

      {submitted && (
        <div className="stack">
          <p>
            結果: <strong><ResultDisplay display={lastResult} /></strong>
          </p>
          <p>次にどうしますか？</p>
          <button disabled={busy} onClick={() => handleEndTurn('goToAnswer')}>
            回答フェイズに進む
          </button>
          <button disabled={busy} onClick={() => handleEndTurn('passTurn')}>
            次の子にターンを渡す
          </button>
        </div>
      )}

      <RuleMemoList rulesPool={gameState.rulesPool} memo={ruleMemo} onCycle={onCycleMemo} />
    </div>
  );
}
