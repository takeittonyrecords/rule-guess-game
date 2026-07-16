import { useState } from 'react';
import { CAT_MARKER } from '../ruleTheme.js';

// 計算結果の表示。通常は文字列（数字やナベアツ風の読み）をそのまま表示するが、
// サーバーからCAT_MARKERが送られてきたときは、猫の画像を表示する。
// 猫の画像ファイル(cat.jpg)が用意されるまでは、絵文字のプレースホルダーで代用する。
// 画像はclient/public/game-assets/cat.jpgに配置する（Viteのpublicフォルダはビルド時に
// そのままルート直下にコピーされるため、src配下からの相対パス参照よりも確実に届く）。
export default function ResultDisplay({ display }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (display === CAT_MARKER) {
    if (imageFailed) {
      return <span className="cat-result-placeholder">🐱</span>;
    }
    return (
      <img
        src="/game-assets/cat.jpg"
        alt="猫"
        className="cat-result-image"
        onError={() => setImageFailed(true)}
      />
    );
  }
  return <span>{display}</span>;
}
