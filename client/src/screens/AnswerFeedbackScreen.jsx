import JudgementStamp from './JudgementStamp.jsx';

export default function AnswerFeedbackScreen({ judgement, onContinue }) {
  return (
    <div className="screen center">
      <h2>判定結果</h2>
      <JudgementStamp judgement={judgement} />
      <button onClick={onContinue}>試験問題に戻る</button>
    </div>
  );
}
