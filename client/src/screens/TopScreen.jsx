import { useState } from 'react';

export default function TopScreen({ onCreateRoom, onJoinRoom }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="screen center">
      <h1 className="title-graphic-wrap">
        <svg
          viewBox="0 0 480 150"
          className="title-svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c6fee" />
              <stop offset="100%" stopColor="#e0518a" />
            </linearGradient>
          </defs>
          <text x="90" y="38" className="title-svg-sparkle-sm">✧</text>
          <text x="18" y="88" className="title-svg-sparkle">✦</text>
          <text x="462" y="88" textAnchor="end" className="title-svg-sparkle">✦</text>
          <text x="392" y="118" className="title-svg-sparkle-sm">✧</text>
          <text x="240" y="86" textAnchor="middle" className="title-svg-text">
            まじかる単位認定
          </text>
          <path d="M64 110 Q240 134 416 110" className="title-svg-underline" />
        </svg>
        <span className="sr-only">まじかる単位認定</span>
      </h1>

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
            <button onClick={() => setMode('create')}>
              <i className="ti ti-door-enter" aria-hidden="true" />
              部屋を作る（ホスト）
            </button>
            <button onClick={() => setMode('join')}>
              <i className="ti ti-login" aria-hidden="true" />
              部屋に入る（参加者）
            </button>
          </div>
        </>
      )}

      {mode === 'create' && (
        <div className="stack">
          <label>
            表示名（任意）
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ホスト" />
          </label>
          <button onClick={() => onCreateRoom(name)}>
            <i className="ti ti-wand" aria-hidden="true" />
            部屋を作成する
          </button>
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
          <button onClick={() => onJoinRoom(code, name)}>
            <i className="ti ti-login" aria-hidden="true" />
            参加する
          </button>
          <button className="link" onClick={() => setMode(null)}>戻る</button>
        </div>
      )}
    </div>
  );
}
