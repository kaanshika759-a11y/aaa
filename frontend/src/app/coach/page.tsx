"use client";

/**
 * AI Coach Page – voice + text AI interaction
 * Full pipeline: Mic → STT → LLM → TTS (via Socket.io)
 *               Text → LLM → TTS (via Socket.io text_message)
 *
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
 *   → start_listening { language }
 *   → audio_chunk (binary PCM)
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
import { LANGUAGES } from "@/lib/languages";
import { recordSession } from "@/store/userStore";
import {
  listenSpeech,
  getSpeechLocale,
  speakResponse,
  stopSpeech,
} from "@/services/speechService";

type AppState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Message {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: Date;
}

export default function CoachPage() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [coachTokenBuffer, setCoachTokenBuffer] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string>("");
  const [sessionStartTime] = useState(Date.now());

  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const ttsEndedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const textInputRef = useRef<HTMLInputElement>(null);
  const speechSessionRef = useRef<{ stop: () => void } | null>(null);
  const liveTranscriptRef = useRef("");
  const selectedLanguageRef = useRef(selectedLanguage);
  // Synchronous guard against duplicate / rapid in-flight requests
  const isSendingRef = useRef(false);
  const hasSentCurrentUtteranceRef = useRef(false);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachTokenBuffer]);

  // ── Socket.io setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
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

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setErrorMsg(`Cannot connect to backend: ${err.message}`);
      setIsConnected(false);
      isSendingRef.current = false;
      setIsSending(false);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
      isSendingRef.current = false;
      setIsSending(false);
      setAppState("idle");
    });

    // Handle client-side TTS (when server has no TTS configured)
    socket.on("use_client_tts", ({ text, language }: { text: string; language?: string }) => {
      console.log("[Coach] Using client-side TTS for:", text.substring(0, 30) + "...");
      const targetLang = language || selectedLanguageRef.current;
      setCurrentlySpeakingText(text);
      setAppState("speaking");
      speakResponse(text, targetLang, () => {
        setCurrentlySpeakingText("");
        setAppState("idle");
      });
    });

    socket.on("coach_thinking", () => {
      stopSpeech();
      setCurrentlySpeakingText("");
      setAppState("thinking");
      setCoachTokenBuffer("");
    });

    socket.on("coach_token", ({ token }: { token: string }) => {
      setCoachTokenBuffer((prev) => prev + token);
    });

    socket.on("coach_reply_complete", ({ reply, language }: { reply: string; language?: string }) => {
      isSendingRef.current = false;
      setIsSending(false);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "coach", text: reply, timestamp: new Date() },
      ]);
      setCoachTokenBuffer("");
    });

    // ── TTS: buffer ALL chunks, then play after tts_end ──
    socket.on("tts_start", () => {
      setAppState("speaking");
      audioQueueRef.current = [];
      ttsEndedRef.current = false;
      isPlayingRef.current = false;
    });

    socket.on("tts_audio_chunk", (chunk: ArrayBuffer | Uint8Array) => {
      const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      audioQueueRef.current.push(u8);
    });

    socket.on("tts_end", () => {
      ttsEndedRef.current = true;
      if (!isPlayingRef.current) {
        playBufferedAudio();
      }
    });

    socket.on("error", ({ source, message }: { source: string; message: string }) => {
      console.error(`[Socket Error] ${source}: ${message}`);
      isSendingRef.current = false;
      setErrorMsg(`${source}: ${message}`);
      setAppState("error");
      setTimeout(() => setAppState("idle"), 5000);
    });

    return () => {
      socket.disconnect();
      stopMic();
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Play all buffered audio at once after tts_end ──────────────────────────
  const playBufferedAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setAppState("idle");
      return;
    }
    isPlayingRef.current = true;

    const chunks = audioQueueRef.current.splice(0);
    const blob = new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      setAppState("idle");
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      setAppState("idle");
    };

    audio.play().catch(() => {
      // Fallback if browser blocks HTML5 autoplay: speak text via Web Speech API
      if (typeof window !== "undefined" && "speechSynthesis" in window && coachTokenBuffer) {
        setAppState("speaking");
        speakResponse(coachTokenBuffer, selectedLanguageRef.current, () => {
          isPlayingRef.current = false;
          setAppState("idle");
        });
      } else {
        isPlayingRef.current = false;
        setAppState("idle");
      }
    });
  }, [coachTokenBuffer]);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleSpeak = useCallback((text: string) => {
    if (currentlySpeakingText === text) {
      stopSpeech();
      setCurrentlySpeakingText("");
      setAppState("idle");
      return;
    }

    stopSpeech();
    setCurrentlySpeakingText(text);
    setAppState("speaking");
    speakResponse(text, selectedLanguageRef.current, () => {
      setCurrentlySpeakingText("");
      setAppState("idle");
    });
  }, [currentlySpeakingText]);

  // ── Universal message send (used by both text input and voice auto-submit) ──
  const sendMessage = useCallback((textToSend?: string) => {
    // Guard: Prevent double-click or rapid submission while in-flight or thinking
    if (isSendingRef.current) {
      console.log("[Coach] ⏳ Duplicate submission blocked — request already in-flight");
      return;
    }

    const text = (textToSend !== undefined ? textToSend : textInput).trim();
    if (!text) return;

    isSendingRef.current = true;
    setIsSending(true);
    stopSpeech();
    setCurrentlySpeakingText("");

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Immediately update UI chat box with the user's spoken or typed input
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, timestamp: new Date() },
    ]);
    setTextInput("");
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    setAppState("thinking");

    if (socketRef.current?.connected) {
      socketRef.current.emit("text_message", {
        text,
        language: selectedLanguageRef.current,
      });
    } else {
      isSendingRef.current = false;
      setIsSending(false);
      setErrorMsg("Not connected to backend server.");
      setAppState("error");
      setTimeout(() => setAppState("idle"), 4000);
    }
  }, [textInput]);

  // ── Mic / Voice capture using Web Speech API ──────────────────────────────
  const startMic = useCallback(async (langOverride?: string) => {
    if (typeof window === "undefined") {
      setErrorMsg("Voice input is not available in this environment.");
      setAppState("error");
      setTimeout(() => setAppState("idle"), 6000);
      return;
    }

    if (isSendingRef.current) {
      console.log("[Mic] Cannot start recording while coach is processing");
      return;
    }

    stopSpeech();
    setCurrentlySpeakingText("");

    const currentLang = langOverride || selectedLanguageRef.current;
    setAppState("listening");
    setErrorMsg("");
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    hasSentCurrentUtteranceRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const session = await listenSpeech({
      language: currentLang,
      continuous: true,
      onResult: (text: string, isFinal: boolean) => {
        if (!isFinal) {
          setLiveTranscript(text);
          liveTranscriptRef.current = text;

          // Silence timeout: if user pauses speaking for 1.6 seconds, auto-submit the interim text
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            const pending = liveTranscriptRef.current.trim();
            if (pending && !isSendingRef.current) {
              hasSentCurrentUtteranceRef.current = true;
              liveTranscriptRef.current = "";
              setLiveTranscript("");
              sendMessage(pending);
            }
          }, 1600);
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (hasSentCurrentUtteranceRef.current) {
            // Already sent via silence timeout — reset flag and do not send duplicate
            hasSentCurrentUtteranceRef.current = false;
            liveTranscriptRef.current = "";
            setLiveTranscript("");
          } else {
            const finalText = text.trim();
            liveTranscriptRef.current = "";
            setLiveTranscript("");
            if (finalText && !isSendingRef.current) {
              sendMessage(finalText);
            }
          }
        }
      },
      onError: (message: string) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        console.warn("[Coach Mic Error]", message);
        // Only trigger prominent error banner for actual permission or missing microphone blocks
        if (
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("microphone was found") ||
          message.toLowerCase().includes("not supported")
        ) {
          setErrorMsg(message);
          setAppState("error");
          setTimeout(() => setAppState("idle"), 5000);
        } else {
          // For network or transient drops, cleanly return to idle state without locking UI
          setAppState("idle");
        }
      },
      onEnd: () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setAppState((curr) => (curr === "listening" ? "idle" : curr));
      },
    });

    if (!session) {
      setAppState("idle");
      return;
    }

    speechSessionRef.current = session;
    console.log("[Mic] ✅ Web Speech API started, language:", currentLang);
  }, [sendMessage]);

  const stopMic = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // If there is an unfinalized live transcript when stopping, auto-submit once
    const pendingText = liveTranscriptRef.current.trim();
    liveTranscriptRef.current = "";
    setLiveTranscript("");

    if (speechSessionRef.current) {
      speechSessionRef.current.stop();
      speechSessionRef.current = null;
    }

    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
    setAppState("idle");

    if (!hasSentCurrentUtteranceRef.current && pendingText && !isSendingRef.current) {
      sendMessage(pendingText);
    }
    hasSentCurrentUtteranceRef.current = false;
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isBusy && !isSendingRef.current && textInput.trim()) {
        sendMessage();
      }
    }
  };

  // ── Mic toggle ──────────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (isBusy || isSendingRef.current) return;
    if (appState === "listening") stopMic();
    else if (appState === "idle") startMic();
  };

  const handleClearSession = () => {
    // Record session before clearing
    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    const wordsSpoken = messages
      .filter((m) => m.role === "user")
      .reduce((acc, m) => acc + m.text.split(" ").length, 0);
    recordSession({
      date: new Date().toDateString(),
      type: "voice",
      durationSeconds: durationSec,
      wordsSpoken,
      messagesCount: messages.length,
    });
    stopMic();
    setMessages([]);
    setLiveTranscript("");
    setCoachTokenBuffer("");
  };

  const micActive = appState === "listening";
  const isBusy = appState === "thinking" || appState === "speaking" || isSending;

  // ── Supported languages for dynamic STT & TTS ────────────────────────────
  const sttLanguages = LANGUAGES;

  return (
    <div className="relative flex-1 min-h-full bg-slate-950 flex flex-col select-none">
      {/* Background orbs */}
      <div className="orb w-[500px] h-[500px] -top-32 -left-32 opacity-15"
        style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }} />
      <div className="orb w-[400px] h-[400px] bottom-0 -right-32 opacity-10"
        style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)" }} />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-4 lg:px-8 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none tracking-tight text-slate-50">AI Coach</h1>
            <p className="text-xs text-slate-400 mt-1">Real-time voice & text communication practice</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language selector for STT & TTS */}
          <select
            id="stt-language-select"
            value={selectedLanguage}
            onChange={(e) => {
              const newLang = e.target.value;
              setSelectedLanguage(newLang);
              stopSpeech();
              setCurrentlySpeakingText("");
              if (appState === "listening") {
                stopMic();
                setTimeout(() => {
                  startMic(newLang);
                }, 200);
              }
            }}
            disabled={isBusy}
            className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500/50 disabled:opacity-40 transition"
          >
            {sttLanguages.map((l) => {
              const locale = getSpeechLocale(l.code);
              return (
                <option key={l.code} value={locale}>
                  {l.name} ({l.nativeName})
                </option>
              );
            })}
          </select>

          <StatusBadge state={appState} isConnected={isConnected} />

          {messages.length > 0 && (
            <button
              id="clear-session-btn"
              onClick={handleClearSession}
              className="text-xs py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

        {/* ─ LEFT: Visualizer & Controls ── */}
        <section className="flex-shrink-0 w-full lg:w-[380px] xl:w-[420px] flex flex-col items-center gap-5 px-4 lg:px-6 py-6 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/40 overflow-y-auto">

          <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
            <AudioVisualizer
              isActive={micActive || appState === "speaking"}
              audioLevel={audioLevel}
              appState={appState}
            />
          </div>

          {/* Mic Button with Cyan Glow Accent */}
          <div className="flex flex-col items-center gap-2">
            <button
              id="mic-toggle-btn"
              onClick={handleMicToggle}
              disabled={isBusy || !isConnected}
              aria-label={micActive ? "Stop listening" : "Start listening"}
              className={`
                relative w-20 h-20 rounded-full font-semibold transition-all duration-300 flex items-center justify-center
                disabled:opacity-40 disabled:cursor-not-allowed
                ${micActive
                  ? "bg-red-500/90 shadow-[0_0_24px_rgba(239,68,68,0.7),0_0_48px_rgba(239,68,68,0.4)]"
                  : "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_24px_rgba(6,182,212,0.45),0_0_48px_rgba(37,99,235,0.25)] hover:shadow-[0_0_32px_rgba(6,182,212,0.7)] hover:scale-105"
                }
              `}
            >
              {micActive && (
                <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
              )}
              {micActive ? (
                <svg className="w-8 h-8 mx-auto" fill="white" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-8 h-8 mx-auto" fill="white" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>

            <p className="text-sm text-slate-400 font-medium text-center">
              {appState === "idle" && (isConnected ? "Tap to speak" : "Connecting...")}
              {appState === "listening" && "Listening… tap to stop"}
              {appState === "thinking" && "Coach is thinking…"}
              {appState === "speaking" && "Coach is speaking…"}
              {appState === "error" && "Something went wrong"}
            </p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {appState === "error" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full bg-red-950/40 border border-red-500/50 rounded-2xl p-4 text-sm text-red-300"
              >
                ⚠️ {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection prompt */}
          {!isConnected && (
            <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-200">💡 Backend Service</p>
              <p>Run: <code className="font-mono bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded">cd backend && node server.js</code></p>
            </div>
          )}

          {messages.length === 0 && isConnected && (
            <div className="w-full bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">💡 Try asking:</p>
              {[
                "Main introduce karna chahta hoon",
                "How do I say 'I need help' professionally?",
                "Practice interview with me",
              ].map((tip) => (
                <button
                  key={tip}
                  onClick={() => {
                    setTextInput(tip);
                    textInputRef.current?.focus();
                  }}
                  className="block w-full text-left text-xs text-slate-300 hover:text-cyan-300 py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/30 transition-all"
                >
                  "{tip}"
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─ RIGHT: Conversation Panel ── */}
        <section className="flex-1 flex flex-col min-h-0 bg-slate-950">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.length === 0 && !coachTokenBuffer && !liveTranscript && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <div>
                    <p className="text-slate-100 font-semibold text-base">Ready to practice English speaking!</p>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-sm leading-relaxed">
                      Tap the mic and speak in Hindi or your mother tongue, or type your question below to get instant coaching.
                    </p>
                  </div>
                </motion.div>
              )}

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
                    <CoachMessage
                      text={msg.text}
                      timestamp={msg.timestamp}
                      onSpeak={handleToggleSpeak}
                      isSpeaking={currentlySpeakingText === msg.text}
                    />
                  )}
                </motion.div>
              ))}

              {liveTranscript && (
                <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <TranscriptBubble text={liveTranscript} isLive />
                </motion.div>
              )}

              {coachTokenBuffer && (
                <motion.div key="stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <CoachMessage text={coachTokenBuffer} isStreaming />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* ── Text input bar ── */}
          <div className="border-t border-slate-800/80 p-4 bg-slate-950/90 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-3">
              <input
                ref={textInputRef}
                id="text-input"
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… type in Hindi, English, or any language"
                disabled={isBusy || !isConnected}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:bg-slate-900/90 disabled:opacity-40 transition-all shadow-inner"
              />
              <button
                id="mic-inline-btn"
                onClick={handleMicToggle}
                disabled={isBusy || !isConnected}
                aria-label="Toggle microphone"
                className={`
                  w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm
                  ${micActive
                    ? "bg-red-500 text-white shadow-red-500/30"
                    : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-cyan-500/40"
                  }
                  disabled:opacity-40
                `}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  {micActive ? (
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  ) : (
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  )}
                </svg>
              </button>
              <button
                id="send-text-btn"
                onClick={() => sendMessage()}
                disabled={!textInput.trim() || isBusy || !isConnected}
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {isConnected ? `🟢 Connected · ${messages.length} message${messages.length !== 1 ? "s" : ""}` : "🔴 Disconnected from backend"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}


