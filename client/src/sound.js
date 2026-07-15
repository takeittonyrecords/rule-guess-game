// v2で追加: 効果音再生ヘルパー。
// 音源ファイル(client/src/assets/stamp.mp3)が未配置の場合は再生に失敗するだけで、
// アプリの動作には影響しない（catchで握りつぶす）。
// 音源: 和太鼓のスタンプ音（ユーザー提供）。
const STAMP_SOUND_URL = './assets/stamp.mp3';

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
