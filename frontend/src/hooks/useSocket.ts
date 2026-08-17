"use client";

/**
 * useSocket – Custom hook for managing the Socket.io connection lifecycle.
 * Provides typed event subscription and emission helpers.
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

type EventHandler<T = unknown> = (data: T) => void;

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    socketRef.current = io(url, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [url, autoConnect]);

  const emit = useCallback(<T>(event: string, data?: T) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback(<T>(event: string, handler: EventHandler<T>) => {
    socketRef.current?.on(event, handler as EventHandler);
    return () => {
      socketRef.current?.off(event, handler as EventHandler);
    };
  }, []);

  const off = useCallback((event: string, handler?: EventHandler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef, emit, on, off };
}
