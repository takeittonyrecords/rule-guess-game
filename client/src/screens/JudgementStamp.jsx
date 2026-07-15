import { useEffect, useRef } from 'react';
import { JUDGEMENT_LABEL, JUDGEMENT_DESCRIPTION } from '../ruleTheme.js';
import { playStampSound } from '../sound.js';

// v2で追加: 回答フェイズの判定結果を、赤い判子風のスタンプアニメーションで表示する。
// 結果発表から約0.3秒後に、勢いよく判が押されるアニメーションを再生し、
// 同じタイミングでスタンプ音を鳴らす。
export default function JudgementStamp({ judgement }) {
  const label = JUDGEMENT_LABEL[judgement] || judgement;
  const description = JUDGEMENT_DESCRIPTION[judgement] || '';
  const stampRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (stampRef.current) {
        stampRef.current.classList.add('stamp-play');
      }
      playStampSound();
    }, 300);
    return () => clearTimeout(timer);
  }, [judgement]);

  return (
    <div className="judgement-stamp-wrap">
      <div ref={stampRef} className="judgement-stamp">
        <span>{label}</span>
      </div>
      {description && <p className="hint">{description}</p>}
    </div>
  );
}
