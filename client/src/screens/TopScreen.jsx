import { useState } from 'react';

export default function TopScreen({ onCreateRoom, onJoinRoom }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="screen center">
      <h1>まじかる単位認定</h1>

      {!mode && (
        <>
          <p className="flavor-text">
            「単位が足りない！」
            <br />
            このままでは留年と教授に土下座するが、嫌らしい教授は「わかっているね…？」とほくそ笑んでくる。
            <br />
            数字も式も、見た目通りとは限らない。
            <br />
            仕掛けられたルールを見破って、なんとしても卒業するんだ！
          </p>
          <div className="stack">
            <button onClick={() => setMode('create')}>部屋を作る（ホスト）</button>
            <button onClick={() => setMode('join')}>部屋に入る（参加者）</button>
          </div>
        </>
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
