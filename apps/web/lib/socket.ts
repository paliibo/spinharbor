'use client';
import type { ClientToServerEvents, ServerToClientEvents } from '@spinharbor/contracts';
import { io, type Socket } from 'socket.io-client';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
let socket: AppSocket | null = null;

/** Singleton Socket.IO client. Cookies carry the auth; reconnection is automatic. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(WS_URL, { withCredentials: true, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000 });
  }
  return socket;
}

/** Force a fresh handshake (after login/logout) so the server re-evaluates the auth cookie. */
export function reconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}
