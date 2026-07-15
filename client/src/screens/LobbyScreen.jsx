export default function LobbyScreen({ gameState, amHost, onAssignParent }) {
  const parentName = gameState.members.find((m) => m.id === gameState.currentParentId)?.name;

  return (
    <div className="screen">
      <h2>部屋コード: {gameState.code}</h2>

      <h3>参加者</h3>
      <ul className="rule-list">
        {gameState.members.map((m) => (
          <li key={m.id}>
            {m.name}
            {m.id === gameState.hostId && '（ホスト）'}
            {m.id === gameState.currentParentId && '（このラウンドの親）'}
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
                  {m.name} を親にする
                </button>
              </li>
            ))}
          </ul>
          {gameState.members.length < 2 && (
            <p className="hint">他のメンバーの参加を待っています（2人以上必要です）</p>
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
