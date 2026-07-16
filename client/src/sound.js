// v2で追加: 効果音再生ヘルパー。
// 音源ファイル(client/public/game-assets/stamp.mp3)が未配置の場合は再生に失敗するだけで、
// アプリの動作には影響しない（catchで握りつぶす）。
// publicフォルダに置くことで、ビルド後もルート直下のパスで確実に読み込める。
// 音源: 和太鼓のスタンプ音（ユーザー提供）。
const STAMP_SOUND_URL = '/game-assets/stamp.mp3';

export function playStampSound() {
  try {
    const audio = new Audio(STAMP_SOUND_URL);
    audio.play().catch(() => {
      // 音源ファイル未配置、またはブラウザの自動再生制限。無視して続行する。
    });
  } catch {
    // Audio自体が使えない環境でも無視する。
  }
}
