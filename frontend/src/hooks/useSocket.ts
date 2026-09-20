import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Message {
  /** Internal state may temporarily hold 'assistant' from legacy code.
   *  It is ALWAYS translated to 'model' before being sent over the socket. */
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export const useSocket = (serverUrl: string = 'http://localhost:4000') => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('response-chunk', (chunk: string) => {
      setIsThinking(false);
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'model') {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + chunk,
          };
          return updated;
        } else {
          return [...prev, { role: 'model', content: chunk }];
        }
      });
    });

    socket.on('response-end', () => {
      setIsThinking(false);
    });

    socket.on('error', () => {
      setIsThinking(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  const sendMessage = useCallback((prompt: string) => {
    if (!prompt.trim() || !socketRef.current) return;

    const userMsg: Message = { role: 'user', content: prompt };

    setMessages((prev) => {
      const updatedHistory = [...prev, userMsg];

      // Layer 3: explicit 'assistant' → 'model' translation.
      // This is the last client-side gate before the payload hits the wire.
      const formattedHistory = updatedHistory.map((msg) => ({
        // Translate any OpenAI-style 'assistant' role to Gemini's 'model'
        role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      socketRef.current?.emit('user-message', {
        prompt,
        history: formattedHistory,
      });

      return updatedHistory;
    });

    setIsThinking(true);
  }, []);

  /**
   * clearMessages – resets all local chat state AND re-initiates the socket
   * connection so no corrupt history is retransmitted in the next session.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsThinking(false);
    // Reconnect socket to start a completely fresh server-side session
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  return {
    messages,
    isConnected,
    isThinking,
    sendMessage,
    clearMessages,
  };
};

export default useSocket;