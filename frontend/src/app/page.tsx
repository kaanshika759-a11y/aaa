"use client";

/**
 * ApniAwaaz – Main Page
 * ============================================================
 * Socket events consumed:
 *   ← listening_started / listening_stopped
 *   ← transcript { transcript, isFinal }
 *   ← coach_thinking
 *   ← coach_token { token }
 *   ← coach_reply_complete { reply }
 *   ← tts_start / tts_audio_chunk (Uint8Array) / tts_end
 *   ← error { source, message }
 *
 * Socket events emitted:
 *   → start_listening
 *   → audio_chunk (binary PCM/opus)
 *   → stop_listening
 *   → text_message { text }
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import AudioVisualizer from "@/components/AudioVisualizer";
import CoachMessage from "@/components/CoachMessage";
import TranscriptBubble from "@/components/TranscriptBubble";
import StatusBadge from "@/components/StatusBadge";
import ConfidenceScore from "@/components/ConfidenceScore";

// ─── Types ────────────────────────────────────────────────────────────────────
type AppState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Message {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  // State
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [coachTokenBuffer, setCoachTokenBuffer] = useState("");
  const [audioLevel, setAudioLevel] = useState(0); // 0–1 for visualizer
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // ── Auto-scroll messages ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachTokenBuffer]);

  // ── Socket.io setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const SOCKET_URL =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
      setAppState("idle");
    });

    // ── STT events ──────────────────────────────────────────────────────────
    socket.on("listening_started", () => setAppState("listening"));
    socket.on("listening_stopped", () => {
      if (appState === "listening") setAppState("idle");
    });

    socket.on("transcript", ({ transcript, isFinal }) => {
      setLiveTranscript(transcript);
      if (isFinal && transcript.trim()) {
        // Commit live transcript as user message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            text: transcript,
            timestamp: new Date(),
          },
        ]);
        setLiveTranscript("");
      }
    });

    // ── LLM events ──────────────────────────────────────────────────────────
    socket.on("coach_thinking", () => {
      setAppState("thinking");
      setCoachTokenBuffer("");
    });

    socket.on("coach_token", ({ token }: { token: string }) => {
      setCoachTokenBuffer((prev) => prev + token);
    });

    socket.on(
      "coach_reply_complete",
      ({ reply }: { reply: string }) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "coach",
            text: reply,
            timestamp: new Date(),
          },
        ]);
        setCoachTokenBuffer("");
      }
    );

    // ── TTS events ──────────────────────────────────────────────────────────
    socket.on("tts_start", () => {
      setAppState("speaking");
      audioQueueRef.current = [];
    });

    socket.on("tts_audio_chunk", (chunk: Uint8Array) => {
      audioQueueRef.current.push(chunk);
      if (!isPlayingRef.current) playNextChunk();
    });

    socket.on("tts_end", () => {
      // State will revert to idle once the audio queue drains
    });

    // ── Error event ──────────────────────────────────────────────────────────
    socket.on("error", ({ source, message }: { source: string; message: string }) => {
      console.error(`[Socket Error] ${source}: ${message}`);
      setErrorMsg(`${source}: ${message}`);
      setAppState("error");
      setTimeout(() => setAppState("idle"), 5000);
    });

    return () => {
      socket.disconnect();
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic / Audio capture ────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // ScriptProcessor for sending raw PCM to server
      // (Replace with AudioWorklet for production)
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        if (!socketRef.current?.connected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 → Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // ─────────────────────────────────────────────────────────────────
        // BUG FIX #3: Must send Uint8Array, NOT pcm16.buffer (ArrayBuffer).
        // Socket.io serializes an ArrayBuffer as an empty object {}.
        // Wrapping in Uint8Array makes it a proper binary Buffer on the wire.
        // ─────────────────────────────────────────────────────────────────
        socketRef.current.emit("audio_chunk", new Uint8Array(pcm16.buffer));
      };

      // Animate audio level for visualizer
      const updateLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateLevel);

      // ───────────────────────────────────────────────────────────────────
      // BUG FIX #4 (race condition): emit start_listening AFTER the processor
      // is wired up but BEFORE onaudioprocess can fire.
      // Original code had emit at the bottom — audio chunks from onaudioprocess
      // can arrive at the server BEFORE start_listening, so dgConnection is
      // null when the first chunks land and they are silently dropped.
      // ───────────────────────────────────────────────────────────────────
      socketRef.current?.emit("start_listening");
      console.log("[Mic] ✅ start_listening emitted — audio pipeline open");
      setSessionCount((c) => c + 1);
    } catch (err) {
      console.error("[Mic] Error:", err);
      setErrorMsg("Microphone access denied. Please allow mic permissions.");
      setAppState("error");
      setTimeout(() => setAppState("idle"), 4000);
    }
  }, []);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

    processorRef.current = null;
    analyserRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;

    setAudioLevel(0);
    socketRef.current?.emit("stop_listening");
    setAppState("idle");
  }, []);

  // ── TTS Playback (streaming mp3 chunks) ────────────────────────────────────
  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setAppState("idle");
      return;
    }
    isPlayingRef.current = true;

    // Combine all buffered chunks into a single blob
    const chunks = audioQueueRef.current.splice(0);
    const blob = new Blob(chunks, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNextChunk();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      setAppState("idle");
    };

    await audio.play().catch(() => {
      isPlayingRef.current = false;
      setAppState("idle");
    });
  }, []);

  // ── Button handlers ────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (appState === "listening") {
      stopMic();
    } else if (appState === "idle") {
      startMic();
    }
  };

  const handleClearSession = () => {
    stopMic();
    setMessages([]);
    setLiveTranscript("");
    setCoachTokenBuffer("");
    setSessionCount(0);
  };

  // ─── Derived UI state ──────────────────────────────────────────────────────
  const micActive = appState === "listening";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-[#03030a] overflow-hidden">
      {/* ── Background orbs ── */}
      <div
        className="orb w-[600px] h-[600px] -top-32 -left-32 opacity-20"
        style={{ background: "radial-gradient(circle, #0062ff 0%, transparent 70%)" }}
      />
      <div
        className="orb w-[500px] h-[500px] top-1/2 -right-40 opacity-15"
        style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }}
      />
      <div
        className="orb w-[400px] h-[400px] bottom-0 left-1/3 opacity-10"
        style={{ background: "radial-gradient(circle, #00eeff 0%, transparent 70%)" }}
      />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          {/* Logo mark */}
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 opacity-90" />
            <div className="absolute inset-0 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                  fill="white"
                />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none tracking-tight">
              ApniAwaaz
            </h1>
            <p className="text-[11px] text-white/40 mt-0.5 font-mono">
              AI Confidence Coach
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          {sessionCount > 0 && (
            <span className="text-xs text-white/40 font-mono">
              Session #{sessionCount}
            </span>
          )}
          <StatusBadge state={appState} isConnected={isConnected} />
          {messages.length > 0 && (
            <button
              id="clear-session-btn"
              onClick={handleClearSession}
              className="btn-ghost text-xs py-2 px-3"
            >
              Clear
            </button>
          )}
        </motion.div>
      </header>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex flex-col lg:flex-row min-h-[calc(100vh-73px)]">

        {/* ─ LEFT: Visualizer & Controls ─────────────────────────────────────── */}
        <section className="flex-shrink-0 w-full lg:w-[420px] flex flex-col items-center justify-start gap-6 px-6 py-8 border-r border-white/[0.05]">

          {/* Audio Visualizer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="w-full"
          >
            <AudioVisualizer
              isActive={micActive || appState === "speaking"}
              audioLevel={audioLevel}
              appState={appState}
            />
          </motion.div>

          {/* Mic Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <button
              id="mic-toggle-btn"
              onClick={handleMicToggle}
              disabled={appState === "thinking" || appState === "speaking" || !isConnected}
              aria-label={micActive ? "Stop listening" : "Start listening"}
              className={`
                relative w-20 h-20 rounded-full font-semibold transition-all duration-300
                disabled:opacity-40 disabled:cursor-not-allowed
                ${micActive
                  ? "bg-red-500/90 shadow-[0_0_24px_rgba(239,68,68,0.6),0_0_48px_rgba(239,68,68,0.3)]"
                  : "bg-gradient-to-br from-blue-500 to-blue-700 shadow-neon-md hover:shadow-neon-lg"
                }
              `}
            >
              {/* Pulse ring when active */}
              {micActive && (
                <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
              )}

              {micActive ? (
                /* Stop icon */
                <svg className="w-8 h-8 mx-auto" fill="white" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                /* Mic icon */
                <svg className="w-8 h-8 mx-auto" fill="white" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>

            <p className="text-sm text-white/50 font-medium">
              {appState === "idle" && "Tap to speak"}
              {appState === "listening" && "Listening… tap to stop"}
              {appState === "thinking" && "Coach is thinking…"}
              {appState === "speaking" && "Coach is speaking…"}
              {appState === "error" && "Something went wrong"}
            </p>
          </motion.div>

          {/* Confidence Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full"
          >
            <ConfidenceScore messages={messages} />
          </motion.div>

          {/* Error banner */}
          <AnimatePresence>
            {appState === "error" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full glass-card border-red-500/30 p-4 text-sm text-red-400"
              >
                ⚠️ {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ─ RIGHT: Conversation Panel ──────────────────────────────────────── */}
        <section className="flex-1 flex flex-col">
          {/* Conversation history */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4">
            <AnimatePresence initial={false}>
              {messages.length === 0 && !coachTokenBuffer && !liveTranscript && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl glass-card flex items-center justify-center">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <div>
                    <p className="text-white/60 font-medium">
                      Your session hasn&apos;t started yet
                    </p>
                    <p className="text-white/30 text-sm mt-1">
                      Press the mic button and start speaking. Your AI coach is ready.
                    </p>
                  </div>
                  {!isConnected && (
                    <p className="text-yellow-400/80 text-sm glass-card px-4 py-2">
                      ⚡ Connecting to backend…
                    </p>
                  )}
                </motion.div>
              )}

              {/* Conversation messages */}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {msg.role === "user" ? (
                    <TranscriptBubble text={msg.text} timestamp={msg.timestamp} />
                  ) : (
                    <CoachMessage text={msg.text} timestamp={msg.timestamp} />
                  )}
                </motion.div>
              ))}

              {/* Live transcript (interim) */}
              {liveTranscript && (
                <motion.div
                  key="live-transcript"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <TranscriptBubble text={liveTranscript} isLive />
                </motion.div>
              )}

              {/* Streaming coach tokens */}
              {coachTokenBuffer && (
                <motion.div
                  key="coach-stream"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <CoachMessage text={coachTokenBuffer} isStreaming />
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom status bar */}
          <div className="border-t border-white/[0.05] px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-white/25 font-mono">
              {messages.length} message{messages.length !== 1 ? "s" : ""} in session
            </p>
            <p className="text-xs text-white/25">
              {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
