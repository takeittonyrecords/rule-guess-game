// 再接続対応: 猶予期間(2分)を過ぎてもサーバーと再接続できなかった場合に表示する画面。
// サーバー自体が再起動してルーム情報が消えてしまった場合などを想定している
// (Renderの無料プランはインスタンスがいつでも再起動されうるため、対策の対象外にはできない)。
//
// 特権ビューア(親、またはすでにあきらめて監視モードだった子)は、切断される直前に
// 受け取っていたgameStateにすでにselectedRuleIds/内訳が含まれているため、それを
// この端末内のキャッシュとしてそのまま表示できる。それ以外の子は、そもそも
// サーバーからその情報を受け取ったことがないため、キャッシュのしようがない
// （このため、口頭やボイスチャットなど別の手段で親に聞いてもらう想定）。
export default function ConnectionLostScreen({ gameState }) {
  const isPrivileged = !!(gameState && gameState.selectedRuleIds);
  const rulesPool = gameState?.rulesPool || [];
  const correctLabels = (gameState?.selectedRuleIds || [])
    .map((id) => rulesPool.find((r) => r.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="screen center">
      <h2>
        <i className="ti ti-plug-connected-x heading-icon" aria-hidden="true" />
        サーバーとの接続が失われました
      </h2>
      <p className="hint">
        しばらく待っても復帰しませんでした。サーバーの再起動などが原因の可能性があります。
        続けるには、ホストに新しく部屋を作り直してもらってください。
      </p>

      {isPrivileged && (
        <>
          <h3>直前まで選ばれていたルール（最後に取得できていた情報）</h3>
          <ul className="selected-rule-list">
            {correctLabels.length > 0 ? (
              correctLabels.map((label, idx) => <li key={idx}>{label}</li>)
            ) : (
              <li className="hint">情報がありません</li>
            )}
          </ul>
        </>
      )}
      {!isPrivileged && (
        <p className="hint">
          あなたの端末にはこのラウンドの正解ルールの情報が保存されていません。親の方に確認してください。
        </p>
      )}

      <button onClick={() => window.location.reload()}>
        <i className="ti ti-refresh" aria-hidden="true" />
        最初からやり直す
      </button>
    </div>
  );
}
