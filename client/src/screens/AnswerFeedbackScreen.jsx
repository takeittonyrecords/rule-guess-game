import { useState } from 'react';
import { emitAsync } from '../socket.js';
import JudgementStamp from './JudgementStamp.jsx';

export default function AnswerFeedbackScreen({ judgement, roomCode, onContinue, onGiveUp }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleGiveUp() {
    const confirmed = window.confirm(
      'あきらめると、あなたはこのラウンドから抜けて見学モードになります（他の人はそのまま続けられます）。よろしいですか？',
    );
    if (!confirmed) return;
    setError('');
    setBusy(true);
    const res = await emitAsync('child:giveUp', { roomCode });
    setBusy(false);
    if (!res?.ok) {
      setError(res?.error || '送信に失敗しました');
      return;
    }
    onGiveUp();
  }

  return (
    <div className="screen center">
      <h2>
        <i className="ti ti-clipboard-check heading-icon" aria-hidden="true" />
        判定結果
      </h2>
      <JudgementStamp judgement={judgement} />
      {error && <p className="error-text">{error}</p>}
      <button disabled={busy} onClick={onContinue}>
        <i className="ti ti-arrow-back-up" aria-hidden="true" />
        試験問題に戻る
      </button>
      <button disabled={busy} className="link give-up-button" onClick={handleGiveUp}>
        <i className="ti ti-flag" aria-hidden="true" />
        あきらめる
      </button>
    </div>
  );
}
