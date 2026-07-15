import { useState } from 'react';
import { emitAsync } from '../socket.js';
import RuleMemoList from './RuleMemoList.jsx';

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
              <td>{h.resultDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!submitted && (
        <div className="stack">
          <label>
            計算式（0〜99の整数、2〜3項、+ - × ÷ のみ）
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="例: 12+7-3"
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button disabled={busy} onClick={handleSubmit}>
            送信する
          </button>
        </div>
      )}

      {submitted && (
        <div className="stack">
          <p>
            結果: <strong>{lastResult}</strong>
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
