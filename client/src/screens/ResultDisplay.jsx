import { useState } from 'react';
import { CAT_MARKER } from '../ruleTheme.js';

// 計算結果の表示。通常は文字列（数字やナベアツ風の読み）をそのまま表示するが、
// サーバーからCAT_MARKERが送られてきたときは、猫の画像を表示する。
// 猫の画像ファイル(cat.jpg)が用意されるまでは、絵文字のプレースホルダーで代用する。
// 画像はclient/public/game-assets/cat.jpgに配置する（Viteのpublicフォルダはビルド時に
// そのままルート直下にコピーされるため、src配下からの相対パス参照よりも確実に届く）。
//
// size="large" を指定すると、猫が出たときだけ画像を大きくポップイン表示する演出になる。
// 自分の手番で結果が確定した直後（ChildPredictの「結果:」欄）など、注目してほしい箇所で使う。
// 履歴テーブルの各行など、幅が限られる場所ではデフォルト（通常サイズ）のままにする。
export default function ResultDisplay({ display, size = 'normal' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isLarge = size === 'large';

  if (display === CAT_MARKER) {
    if (imageFailed) {
      return (
        <span className={isLarge ? 'cat-result-placeholder cat-result-placeholder--large' : 'cat-result-placeholder'}>
          🐱
        </span>
      );
    }
    return (
      <img
        src="/game-assets/cat.jpg"
        alt="猫"
        className={isLarge ? 'cat-result-image cat-result-image--large' : 'cat-result-image'}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return <span>{display}</span>;
}
