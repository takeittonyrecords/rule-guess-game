import { useEffect, useState, useCallback } from 'react';
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
import { nextMemoSymbol } from './screens/RuleMemoList.jsx';

export default function App() {
  const [joined, setJoined] = useState(false); // 部屋に参加しているか
  const [roomCode, setRoomCode] = useState('');
  const [memberId, setMemberId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  // 卒業以外の回答結果はサーバー側の状態が予測フェイズへ即座に切り替わってしまうため、
  // このローカル状態で一時的にフィードバック画面を割り込ませる。
  const [pendingAnswerFeedback, setPendingAnswerFeedback] = useState(null);
  // ルールごとに付ける推理メモ（？/〇/×）。サーバーには送らない、この端末だけのローカル状態。
  // ChildPredictはターンごとに再マウントされるため、ここ(App)で保持して引き継がせる。
  const [ruleMemo, setRuleMemo] = useState({});

  const resetToTop = useCallback(() => {
    setJoined(false);
    setRoomCode('');
    setMemberId(null);
    setGameState(null);
    setError('');
    setPendingAnswerFeedback(null);
    setRuleMemo({});
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
  const myName = gameState.members.find((m) => m.id === memberId)?.name;

  let content;

  if (pendingAnswerFeedback) {
    content = (
      <AnswerFeedbackScreen
        judgement={pendingAnswerFeedback}
        onContinue={() => setPendingAnswerFeedback(null)}
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
        />
      );
    }
  } else if (phase === 'predict') {
    if (amParent) {
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
    if (!amParent && gameState.answeringChildId === memberId) {
      content = (
        <ChildAnswer
          gameState={gameState}
          roomCode={roomCode}
          onResult={(judgement) => {
            if (judgement !== 'GRADUATE' && judgement !== 'DROPOUT') {
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
          role={amParent ? 'parent' : 'child'}
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
      {content}
    </>
  );
}
