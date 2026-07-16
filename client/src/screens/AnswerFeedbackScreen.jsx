import JudgementStamp from './JudgementStamp.jsx';

export default function AnswerFeedbackScreen({ judgement, onContinue }) {
  return (
    <div className="screen center">
      <h2>
        <i className="ti ti-clipboard-check heading-icon" aria-hidden="true" />
        判定結果
      </h2>
      <JudgementStamp judgement={judgement} />
      <button onClick={onContinue}>
        <i className="ti ti-arrow-back-up" aria-hidden="true" />
        試験問題に戻る
      </button>
    </div>
  );
}
