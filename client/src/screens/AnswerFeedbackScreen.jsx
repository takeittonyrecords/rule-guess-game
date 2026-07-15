import { JUDGEMENT_LABEL } from './ChildAnswer.jsx';

export default function AnswerFeedbackScreen({ judgement, onContinue }) {
  return (
    <div className="screen center">
      <h2>判定結果</h2>
      <p className="judgement">{JUDGEMENT_LABEL[judgement] || judgement}</p>
      <p>クリアではなかったので、予測フェイズに戻れます（ペナルティはありません）。</p>
      <button onClick={onContinue}>予測フェイズに戻る</button>
    </div>
  );
}
