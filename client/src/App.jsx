import { useEffect, useState, useCallback, useRef } from 'react';
import { socket, emitAsync } from './socket.js';

import TopScreen from './screens/TopScreen.jsx';
import LobbyScreen from './screens/LobbyScreen.jsx';
import ParentRuleSelect from './screens/ParentRuleSelect.jsx';
import ParentMonitor from './screens/ParentMonitor.jsx';
import ChildPredict from './screens/ChildPredict.jsx';
import ChildAnswer from './screens/ChildAnswer.jsx';
import WaitingScreen from './screens/WaitingScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import AnswerFeedbackScreen from './screens/AnswerFeedbackScreen.jsx';
import ConnectionLostScreen from './screens/ConnectionLostScreen.jsx';
import { nextMemoSymbol } from './screens/RuleMemoList.jsx';

// 再接続対応: ブラウザのlocalStorageに{roomCode, memberId}を保存しておき、
// ページ再読み込みや通信の一時切断からの復帰時にサーバー側のメンバーと
// 紐付け直す(room:rejoinイベント)ために使う。
const SESSION_KEY = 'ruleGuessGame:session';
// クライアント側で「もう復帰しないだろう」と判断するまでの待ち時間。
// サーバー側の猶予期間(ホスト/子とも2分)とおおむね揃えている。
const CLIENT_GRACE_MS = 2 * 60 * 1000;

function saveSession(roomCode, memberId) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, memberId }));
  } catch {
    // localStorageが使えない環境(プライベートモード等)でも致命的にはしない
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}

export default function App() {
  const [joined, setJoined] = useState(false); // 部屋に参加しているか
  const [roomCode, setRoomCode] = useState('');
  const [memberId, setMemberId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  // 起動直後、保存済みセッションの復元(room:rejoin)を試みている間はtrue。
  // この間はトップ画面をちらつかせず、簡単なローディング表示にする。
  const [restoring, setRestoring] = useState(true);
  // 接続が切れて、まだ猶予期間内に再接続を試みている間はtrue（非ブロッキングな通知用）。
  const [reconnecting, setReconnecting] = useState(false);
  // 猶予期間を過ぎてもサーバーと再接続できなかった場合はtrue。
  const [connectionLost, setConnectionLost] = useState(false);
  // 卒業以外の回答結果はサーバー側の状態が予測フェイズへ即座に切り替わってしまうため、
  // このローカル状態で一時的にフィードバック画面を割り込ませる。
  const [pendingAnswerFeedback, setPendingAnswerFeedback] = useState(null);
  // ルールごとに付ける推理メモ（？/〇/×）。サーバーには送らない、この端末だけのローカル状態。
  // ChildPredictはターンごとに再マウントされるため、ここ(App)で保持して引き継がせる。
  const [ruleMemo, setRuleMemo] = useState({});

  const joinedRef = useRef(false);
  const lostTimerRef = useRef(null);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  const resetToTop = useCallback(() => {
    clearSession();
    setJoined(false);
    setRoomCode('');
    setMemberId(null);
    setGameState(null);
    setError('');
    setPendingAnswerFeedback(null);
    setRuleMemo({});
    setReconnecting(false);
    setConnectionLost(false);
    if (lostTimerRef.current) {
      clearTimeout(lostTimerRef.current);
      lostTimerRef.current = null;
    }
  }, []);

  // 起動時: 保存済みセッションがあれば自動でroom:rejoinを試みる
  useEffect(() => {
    let cancelled = false;
    async function tryRestore() {
      const saved = loadSession();
      if (!saved || !saved.roomCode || !saved.memberId) {
        setRestoring(false);
        return;
      }
      const res = await emitAsync('room:rejoin', {
        roomCode: saved.roomCode,
        memberId: saved.memberId,
      });
      if (cancelled) return;
      if (res?.ok) {
        setJoined(true);
        setRoomCode(res.roomCode);
        setMemberId(res.memberId);
      } else {
        clearSession();
      }
      setRestoring(false);
    }
    tryRestore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onState(state) {
      setGameState(state);
    }
    function onDisbanded() {
      resetToTop();
    }
    socket.on('state:update', onState);
    socket.on('room:disbanded', onDisbanded);
    return () => {
      socket.off('state:update', onState);
      socket.off('room:disbanded', onDisbanded);
    };
  }, [resetToTop]);

  // 再接続対応: 通信が切れたら猶予タイマーを開始し、その間に自動再接続
  // (socket.io-clientの標準機能)できればroom:rejoinで紐付け直す。
  // 猶予時間内に戻らなければconnectionLostに切り替える。
  useEffect(() => {
    function onConnect() {
      if (lostTimerRef.current) {
        clearTimeout(lostTimerRef.current);
        lostTimerRef.current = null;
      }
      setReconnecting(false);
      // すでに部屋に参加した状態からの切断→再接続の場合のみ、こちらから
      // room:rejoinし直す(初回接続時はjoinedRef.currentがfalseなので何もしない。
      // 初回接続時の復元は上のtryRestoreエフェクトが担当する)。
      if (!joinedRef.current) return;
      const saved = loadSession();
      if (!saved || !saved.roomCode || !saved.memberId) return;
      emitAsync('room:rejoin', { roomCode: saved.roomCode, memberId: saved.memberId }).then(
        (res) => {
          if (!res?.ok) {
            clearSession();
            resetToTop();
          } else {
            setConnectionLost(false);
          }
        },
      );
    }
    function onDisconnect() {
      if (!joinedRef.current) return; // まだ部屋に入っていない状態の切断は無視
      setReconnecting(true);
      if (lostTimerRef.current) clearTimeout(lostTimerRef.current);
      lostTimerRef.current = setTimeout(() => {
        setConnectionLost(true);
        setReconnecting(false);
      }, CLIENT_GRACE_MS);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      if (lostTimerRef.current) {
        clearTimeout(lostTimerRef.current);
        lostTimerRef.current = null;
      }
    };
  }, [resetToTop]);

  // ロビーに戻ったら推理メモをリセットする
  useEffect(() => {
    if (gameState?.phase === 'lobby') {
      setRuleMemo({});
    }
  }, [gameState?.phase]);

  const handleCycleMemo = useCallback((ruleId) => {
    setRuleMemo((prev) => ({ ...prev, [ruleId]: nextMemoSymbol(prev[ruleId]) }));
  }, []);

  const handleCreateRoom = useCallback(async (hostName) => {
    setError('');
    const res = await emitAsync('room:create', { hostName });
    if (!res?.ok) {
      setError(res?.error || '部屋の作成に失敗しました');
      return;
    }
    setJoined(true);
    setRoomCode(res.roomCode);
    setMemberId(res.memberId);
    saveSession(res.roomCode, res.memberId);
  }, []);

  const handleJoinRoom = useCallback(async (code, memberName) => {
    setError('');
    const res = await emitAsync('room:join', { roomCode: code, memberName });
    if (!res?.ok) {
      setError(res?.error || '参加に失敗しました');
      return;
    }
    setJoined(true);
    setRoomCode(res.roomCode);
    setMemberId(res.memberId);
    saveSession(res.roomCode, res.memberId);
  }, []);

  const handleDisbandRoom = useCallback(async () => {
    if (!window.confirm('本当に部屋を解散しますか？参加者は全員トップ画面に戻ります。')) {
      return;
    }
    await emitAsync('host:disbandRoom', { roomCode });
    resetToTop();
  }, [roomCode, resetToTop]);

  const handleAssignParent = useCallback(
    async (targetMemberId) => {
      await emitAsync('host:assignParent', { roomCode, memberId: targetMemberId });
    },
    [roomCode],
  );

  const handleAddCPU = useCallback(async () => {
    await emitAsync('host:addCPU', { roomCode });
  }, [roomCode]);

  const handleRemoveCPU = useCallback(async () => {
    await emitAsync('host:removeCPU', { roomCode });
  }, [roomCode]);

  const handleSetCPUDifficulty = useCallback(
    async (difficulty) => {
      await emitAsync('host:setCPUDifficulty', { roomCode, difficulty });
    },
    [roomCode],
  );

  const handleResetToLobby = useCallback(async () => {
    await emitAsync('host:resetToLobby', { roomCode });
  }, [roomCode]);

  if (error) {
    return (
      <div className="screen center">
        <p className="error-text">{error}</p>
        <button onClick={() => window.location.reload()}>最初からやり直す</button>
      </div>
    );
  }

  if (restoring) {
    return (
      <div className="screen center">
        <p>再接続を確認しています...</p>
      </div>
    );
  }

  if (connectionLost) {
    return <ConnectionLostScreen gameState={gameState} />;
  }

  if (!joined) {
    return <TopScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  if (!gameState) {
    return (
      <div className="screen center">
        <p>接続中...</p>
      </div>
    );
  }

  const { phase } = gameState;
  const amHost = memberId === gameState.hostId;
  const amParent = gameState.currentParentId !== null && memberId === gameState.currentParentId;
  // v2で追加: あきらめて監視モードになった子は、親と同じ監視画面(ParentMonitor)を見る。
  const amDroppedOut = (gameState.droppedOutIds || []).includes(memberId);
  const myName = gameState.members.find((m) => m.id === memberId)?.name;

  let content;

  if (pendingAnswerFeedback) {
    content = (
      <AnswerFeedbackScreen
        judgement={pendingAnswerFeedback}
        roomCode={roomCode}
        onContinue={() => setPendingAnswerFeedback(null)}
        onGiveUp={() => setPendingAnswerFeedback(null)}
      />
    );
  } else if (phase === 'lobby') {
    if (gameState.currentParentId === null) {
      // まだこのラウンドの親が決まっていない
      content = (
        <LobbyScreen
          gameState={gameState}
          amHost={amHost}
          onAssignParent={handleAssignParent}
          onAddCPU={handleAddCPU}
          onRemoveCPU={handleRemoveCPU}
          onSetCPUDifficulty={handleSetCPUDifficulty}
        />
      );
    } else if (amParent) {
      content = <ParentRuleSelect gameState={gameState} roomCode={roomCode} />;
    } else {
      content = (
        <LobbyScreen
          gameState={gameState}
          amHost={amHost}
          onAssignParent={handleAssignParent}
          onAddCPU={handleAddCPU}
          onRemoveCPU={handleRemoveCPU}
          onSetCPUDifficulty={handleSetCPUDifficulty}
        />
      );
    }
  } else if (phase === 'predict') {
    if (amParent || amDroppedOut) {
      content = <ParentMonitor gameState={gameState} roomCode={roomCode} />;
    } else {
      const isMyTurn = gameState.currentChildId === memberId;
      if (isMyTurn) {
        // 1対1(子が1人だけ)の場合、ターンを渡してもcurrentChildIdの値が変わらないため、
        // turnToken（新しい手番が始まるたびにサーバー側で増加する値）をkeyにして
        // ターンが切り替わるたびに入力欄を強制的にリセットする。
        content = (
          <ChildPredict
            key={gameState.turnToken}
            gameState={gameState}
            roomCode={roomCode}
            ruleMemo={ruleMemo}
            onCycleMemo={handleCycleMemo}
          />
        );
      } else {
        content = (
          <WaitingScreen
            gameState={gameState}
            memberId={memberId}
            role="child"
            ruleMemo={ruleMemo}
            onCycleMemo={handleCycleMemo}
          />
        );
      }
    }
  } else if (phase === 'answer') {
    if (amParent || amDroppedOut) {
      content = <ParentMonitor gameState={gameState} roomCode={roomCode} />;
    } else if (gameState.answeringChildId === memberId) {
      content = (
        <ChildAnswer
          gameState={gameState}
          roomCode={roomCode}
          onResult={(judgement) => {
            if (judgement !== 'GRADUATE') {
              setPendingAnswerFeedback(judgement);
            }
          }}
        />
      );
    } else {
      content = (
        <WaitingScreen
          gameState={gameState}
          memberId={memberId}
          role="child"
          ruleMemo={ruleMemo}
          onCycleMemo={handleCycleMemo}
          answering
        />
      );
    }
  } else if (phase === 'result') {
    content = (
      <ResultScreen
        gameState={gameState}
        amHost={amHost}
        roomCode={roomCode}
        onResetToLobby={handleResetToLobby}
      />
    );
  } else {
    content = (
      <div className="screen center">
        <p>不明な状態です</p>
      </div>
    );
  }

  return (
    <>
      {amHost && (
        <div className="room-code-banner">
          <span>
            <i className="ti ti-key" aria-hidden="true" />
            部屋コード: <strong>{gameState.code}</strong>
          </span>
          <button className="disband-button" onClick={handleDisbandRoom}>
            <i className="ti ti-trash" aria-hidden="true" />
            部屋を解散する
          </button>
        </div>
      )}
      {!amHost && (
        <div className="child-name-banner">
          <i className="ti ti-user" aria-hidden="true" />
          あなたの名前: <strong>{myName || '(名前未設定)'}</strong>
        </div>
      )}
      {reconnecting && (
        <div className="reconnecting-banner">
          <i className="ti ti-refresh" aria-hidden="true" />
          サーバーとの接続が一時的に切れています。再接続を試みています...
        </div>
      )}
      {!reconnecting && !amHost && gameState?.hostDisconnected && (
        <div className="reconnecting-banner">
          <i className="ti ti-refresh" aria-hidden="true" />
          ホストとの接続が切れています。しばらく待っています...
        </div>
      )}
      {content}
    </>
  );
}
