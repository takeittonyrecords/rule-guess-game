import { useState } from 'react';
import { CAT_MARKER, ANSWER_42_MARKER, ANSWER_42_TEXT } from '../ruleTheme.js';

// 計算結果の表示。通常は文字列（数字やナベアツ風の読み）をそのまま表示するが、
// サーバーから特殊マーカーが送られてきたときは専用の演出を行う。
//
// - CAT_MARKER: 猫の演出。
//   履歴テーブルなど幅が限られる場所（size="normal"、デフォルト）では、
//   画像は使わずテキストで「にゃ～ん」とだけ表示する。
//   自分の手番で結果が確定した直後（size="large"）では、猫の画像を
//   大きくポップイン表示し、その下に「にゃ～ん」というキャプションを添える。
//   画像ファイル(client/public/game-assets/cat.jpg)が読み込めない場合は
//   絵文字のプレースホルダーで代用する。
// - ANSWER_42_MARKER: ルール16（計算結果が42のとき）の名言を斜体で表示する。
//   実際の名言テキストはこのファイルではなくruleTheme.js側に置いてあり、
//   サーバーはマーカー文字列だけを返す。
export default function ResultDisplay({ display, size = 'normal' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isLarge = size === 'large';

  if (display === CAT_MARKER) {
    if (!isLarge) {
      return <span className="cat-result-text">にゃ～ん</span>;
    }
    return (
      <span className="cat-result-large-wrap">
        {imageFailed ? (
          <span className="cat-result-placeholder cat-result-placeholder--large">🐱</span>
        ) : (
          <img
            src="/game-assets/cat.jpg"
            alt="猫"
            className="cat-result-image cat-result-image--large"
            onError={() => setImageFailed(true)}
          />
        )}
        <span className="cat-result-caption">にゃ～ん</span>
      </span>
    );
  }

  if (display === ANSWER_42_MARKER) {
    return <span className="answer42-text">{ANSWER_42_TEXT}</span>;
  }

  return <span>{display}</span>;
}
