import { io } from 'socket.io-client';

// 接続先の決定ルール:
// 1. VITE_SERVER_URL が設定されていれば最優先でそれを使う
//    (スマホなど別端末からLAN内で参加する場合など)
// 2. 未設定かつ本番ビルド(npm run build)の場合は、サーバーが自分自身の
//    ビルド成果物を配信している前提(Renderへの単一サービスデプロイ)なので、
//    同一オリジンに接続する(undefinedを渡すとsocket.io-clientが現在のページの
//    オリジンに自動接続する)。
// 3. 未設定かつ開発時(npm run dev)は、これまで通りローカルの3001番ポートに接続する。
const envUrl = import.meta.env.VITE_SERVER_URL;
const SERVER_URL = envUrl || (import.meta.env.PROD ? undefined : 'http://localhost:3001');

export const socket = io(SERVER_URL, {
  autoConnect: true,
});

// Promise化したemit（サーバー側のack関数を待つ）
export function emitAsync(event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => resolve(response));
  });
}
