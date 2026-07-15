import { useState } from 'react';
import { CAT_MARKER } from '../ruleTheme.js';

// 計算結果の表示。通常は文字列（数字やナベアツ風の読み）をそのまま表示するが、
// サーバーからCAT_MARKERが送られてきたときは、猫の画像を表示する。
// 猫の画像ファイル(cat.jpg)が用意されるまでは、絵文字のプレースホルダーで代用する。
// 実際の写真が用意でき次第、client/src/assets/cat.jpg を追加すれば自動的にそちらが使われる。
export default function ResultDisplay({ display }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (display === CAT_MARKER) {
    if (imageFailed) {
      return <span className="cat-result-placeholder">🐱</span>;
    }
    return (
      <img
        src="./assets/cat.jpg"
        alt="猫"
        className="cat-result-image"
        onError={() => setImageFailed(true)}
      />
    );
  }
  return <span>{display}</span>;
}
