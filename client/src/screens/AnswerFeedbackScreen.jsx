import JudgementStamp from './JudgementStamp.jsx';

export default function AnswerFeedbackScreen({ judgement, onContinue }) {
  return (
    <div className="screen center">
      <h2>判定結果</h2>
      <JudgementStamp judgement={judgement} />
      <p>卒業ではなかったので、予測フェイズに戻れます（ペナルティはありません）。</p>
      <button onClick={onContinue}>予測フェイズに戻る</button>
    </div>
  );
}
