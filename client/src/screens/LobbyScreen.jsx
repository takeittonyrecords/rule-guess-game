const CPU_DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: '初級（1〜2個）' },
  { value: 'intermediate', label: '中級（1〜3個）' },
  { value: 'advanced', label: '上級（2〜5個）' },
  { value: 'hardcore', label: 'ハードコア（4〜5個）' },
];

export default function LobbyScreen({
  gameState,
  amHost,
  onAssignParent,
  onAddCPU,
  onRemoveCPU,
  onSetCPUDifficulty,
}) {
  const parentName = gameState.members.find((m) => m.id === gameState.currentParentId)?.name;
  const cpu = gameState.members.find((m) => m.isCPU);
  const hasCPU = !!cpu;

  return (
    <div className="screen">
      <h2>
        <i className="ti ti-door heading-icon" aria-hidden="true" />
        部屋コード: {gameState.code}
      </h2>

      <h3>参加者</h3>
      <ul className="rule-list">
        {gameState.members.map((m) => (
          <li key={m.id}>
            {m.name}
            {m.id === gameState.hostId && '（ホスト）'}
            {m.id === gameState.currentParentId && '（このラウンドの親）'}
            {m.isCPU && '（CPU）'}
            {m.disconnected && (
              <span className="hint"> （切断中・再接続を待っています）</span>
            )}
          </li>
        ))}
      </ul>

      {amHost ? (
        <>
          <p>
            {gameState.currentParentId === null
              ? 'このラウンドの親を指名してください。'
              : `${parentName} さんが親です。ルール選択が終わるまで、下のボタンで指名を変更できます。`}
          </p>
          <ul className="rule-list">
            {gameState.members.map((m) => (
              <li key={m.id}>
                <button
                  disabled={m.id === gameState.currentParentId}
                  onClick={() => onAssignParent(m.id)}
                >
                  <i className="ti ti-crown" aria-hidden="true" />
                  {m.name} を親にする
                </button>
              </li>
            ))}
          </ul>
          {gameState.members.length < 2 && (
            <p className="hint">他のメンバーの参加を待っています（2人以上必要です）</p>
          )}
          {!hasCPU ? (
            <div className="cpu-invite">
              <p className="hint">
                一人で遊びたいときは、CPUを親役として追加できます。CPUはルールをランダムに選ぶだけで、監視画面などは使いません。
              </p>
              <button type="button" className="link" onClick={onAddCPU}>
                <i className="ti ti-robot" aria-hidden="true" />
                CPUを追加する
              </button>
            </div>
          ) : (
            <div className="cpu-invite">
              <p className="hint">CPUが追加されています。間違えて追加した場合はここから削除できます。</p>
              <div className="cpu-difficulty-picker">
                <span className="cpu-difficulty-label">
                  <i className="ti ti-adjustments" aria-hidden="true" />
                  CPUの難易度:
                </span>
                {CPU_DIFFICULTY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="cpu-difficulty-option">
                    <input
                      type="radio"
                      name="cpuDifficulty"
                      value={opt.value}
                      checked={(cpu.difficulty || 'intermediate') === opt.value}
                      onChange={() => onSetCPUDifficulty(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <button type="button" className="link" onClick={onRemoveCPU}>
                <i className="ti ti-trash" aria-hidden="true" />
                CPUを削除する
              </button>
            </div>
          )}
        </>
      ) : (
        <p>
          {gameState.currentParentId === null
            ? 'ホストがこのラウンドの親を指名しています...'
            : `${parentName} さんが親です。ルールを選んでいます...`}
        </p>
      )}
    </div>
  );
}
