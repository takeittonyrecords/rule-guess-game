import { useState } from 'react';

export default function TopScreen({ onCreateRoom, onJoinRoom }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="screen center">
      <h1>ルール推理計算ゲーム</h1>

      {!mode && (
        <div className="stack">
          <button onClick={() => setMode('create')}>部屋を作る（ホスト）</button>
          <button onClick={() => setMode('join')}>部屋に入る（参加者）</button>
        </div>
      )}

      {mode === 'create' && (
        <div className="stack">
          <label>
            表示名（任意）
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ホスト" />
          </label>
          <button onClick={() => onCreateRoom(name)}>部屋を作成する</button>
          <button className="link" onClick={() => setMode(null)}>戻る</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="stack">
          <label>
            ニックネーム
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="参加者" />
          </label>
          <label>
            部屋コード
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例: AB3CD"
            />
          </label>
          <button onClick={() => onJoinRoom(code, name)}>参加する</button>
          <button className="link" onClick={() => setMode(null)}>戻る</button>
        </div>
      )}
    </div>
  );
}
