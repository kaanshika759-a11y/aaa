"use client";

const RATE_LIMIT_SUBSTRING = "API rate limit reached";

/**
 * Practice Page – English Confidence Coach
 * Supports Daily Conversation and other practice modes with both Voice & Text conversation
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PRACTICE_MODES, PracticeMode } from "@/lib/practiceTopics";
import { getPracticeFeedback } from "@/services/api";
import { recordSession } from "@/store/userStore";
import { speakResponse, stopSpeech } from "@/services/speechService";

type PracticeState = "mode-select" | "topic-select";

interface ConversationMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: string;
  topic?: string;
}

export default function PracticePage() {
  // Practice navigation state: Default to Daily Conversation in topic-select stage
  const [stage, setStage] = useState<PracticeState>("topic-select");
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(PRACTICE_MODES[0]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [attempts, setAttempts] = useState(0);

  // Mode & Input states
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Conversation history
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  // Dom refs
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  // Synchronous in-flight guard to prevent double-submission before React re-renders isSubmitting
  const isSubmittingRef = useRef(false);

  // Focus text input when switching to type mode
  useEffect(() => {
    if (inputMode === "text") {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [inputMode]);

  // Auto-scroll conversation when new messages appear
  useEffect(() => {
    if (conversation.length > 0 || isSubmitting) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation.length, isSubmitting]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  // ── Voice Recognition Handlers ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    setLiveTranscript("");
    setError("");

    if (typeof window === "undefined" || !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Voice recognition is not supported in this browser. Please use Chrome/Edge or switch to Type mode.");
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition;

    try {
      const rec = new SpeechRecognitionAPI();
      recognitionRef.current = rec;
      rec.lang = "en-IN";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      let accumulated = "";

      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            accumulated += t + " ";
          } else {
            interim = t;
          }
        }
        setLiveTranscript(accumulated + interim);
      };

      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") {
          setError("Microphone permission denied. Please allow microphone access or use Type mode.");
        } else if (e.error === "no-speech" || e.error === "network" || e.error === "aborted") {
          // Expected transient issues
        } else {
          console.warn(`Speech recognition error: ${e.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      rec.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Speech recognition start failed:", err);
      setError("Could not start voice recognition. Please try again or switch to Type mode.");
      setIsRecording(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsRecording(false);

    const spokenText = liveTranscript.trim();
    setLiveTranscript("");
    // Guard: don't submit if a request is already in-flight
    if (spokenText && !isSubmittingRef.current) {
      submitToCoach(spokenText);
    }
  }, [liveTranscript]);

  const cancelListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsRecording(false);
    setLiveTranscript("");
  }, []);

  // ── Feedback Submission (shared for Voice and Text) ────────────────────────
  const submitToCoach = async (text: string) => {
    // Use ref-based guard (synchronous) to prevent double-submission before
    // React state has flushed across re-renders
    if (!text.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setError("");
    setIsSubmitting(true);
    const activeTopic = selectedTopic;
    const modeId = selectedMode?.id ?? "daily-conversation";

    const userMsg: ConversationMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      topic: activeTopic || undefined,
    };

    setConversation((prev) => [...prev, userMsg]);

    try {
      const res = await getPracticeFeedback(text.trim(), modeId, activeTopic);

      // Detect rate-limit response embedded in a reply
      if (res.feedback && res.feedback.includes(RATE_LIMIT_SUBSTRING)) {
        setError(`⏳ ${res.feedback}`);
        return;
      }

      const coachMsg: ConversationMessage = {
        id: `coach-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: "coach",
        text: res.feedback,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        topic: activeTopic || undefined,
      };

      setConversation((prev) => [...prev, coachMsg]);
      setAttempts((a) => a + 1);

      recordSession({
        date: new Date().toDateString(),
        type: "practice",
        durationSeconds: Math.round(text.split(" ").length * 0.4),
        wordsSpoken: text.split(" ").length,
        messagesCount: 1,
      });
    } catch (err: unknown) {
      console.error("[Practice] Feedback API error:", err);
      const errMsg = (err as Error).message ?? "Failed to get AI response. Please check your connection.";
      // Surface rate-limit errors with a friendlier message
      if (errMsg.includes(RATE_LIMIT_SUBSTRING) || errMsg.includes("429")) {
        setError("⏳ Coach is busy right now — the AI rate limit was reached. Please wait a moment and try again.");
      } else {
        setError(errMsg);
      }
      throw err; // Re-throw so caller can handle input preservation
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Text Submit Handler ───────────────────────────────────────────────────
  const handleTextSubmit = async () => {
    const text = message.trim();
    if (!text || isSubmitting) return;

    const savedText = text;
    setMessage(""); // Clear input on submit

    try {
      await submitToCoach(savedText);
    } catch {
      // Preserve typed text if an API error occurs
      setMessage(savedText);
    }
  };

  // ── Audio Playback for Coach Feedback ─────────────────────────────────────
  const handleToggleSpeak = (id: string, text: string) => {
    if (speakingMessageId === id) {
      stopSpeech();
      setSpeakingMessageId(null);
    } else {
      stopSpeech();
      setSpeakingMessageId(id);
      speakResponse(text, "en-IN", () => {
        setSpeakingMessageId(null);
      });
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    stopSpeech();
    setIsRecording(false);
    setLiveTranscript("");
    if (stage === "topic-select") {
      setStage("mode-select");
      setSelectedMode(null);
      setSelectedTopic("");
    }
  };

  return (
    <div className="relative min-h-full w-full bg-[#03030a] py-8 px-4 lg:px-8">
      {/* Background ambient glow */}
      <div
        className="orb w-[400px] h-[400px] -top-20 -right-20 opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
      />

      <div className="relative z-10 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {stage !== "mode-select" && (
            <button
              onClick={goBack}
              aria-label="Back to practice modes"
              className="w-10 h-10 rounded-xl bg-white/05 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              ←
            </button>
          )}
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
              {stage === "mode-select" ? "🎯 Practice Modes" : selectedMode?.title ?? "Daily Conversation"}
            </h1>
            <p className="text-white/50 text-sm">
              {stage === "mode-select"
                ? "Choose a mode to boost your spoken English confidence"
                : selectedMode?.description ?? "Practice everyday English for daily life"}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Mode Selection Stage ── */}
          {stage === "mode-select" && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {PRACTICE_MODES.map((mode, i) => (
                <motion.button
                  key={mode.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => {
                    setSelectedMode(mode);
                    setSelectedTopic("");
                    setStage("topic-select");
                  }}
                  id={`practice-mode-${mode.id}`}
                  className="glass-card p-5 text-left hover:border-white/25 transition-all group"
                >
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{mode.icon}</div>
                  <h2 className="text-white font-semibold text-base mb-1">{mode.title}</h2>
                  <p className="text-white/40 text-xs leading-relaxed">{mode.description}</p>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* ── Main Conversation Stage (Daily Conversation) ── */}
          {stage === "topic-select" && selectedMode && (
            <motion.div
              key="topic-conversation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Topics Selection Card */}
              <div className="glass-card p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Select a Topic or Speak Freely:
                  </span>
                  {selectedTopic && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopic("")}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Clear selection (Speak Freely)
                    </button>
                  )}
                </div>

                {/* Topic selection chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedMode.topics.map((topic) => {
                    const isSelected = selectedTopic === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setSelectedTopic(isSelected ? "" : topic)}
                        aria-pressed={isSelected}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-blue-600 border border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.35)]"
                            : "bg-white/05 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>

                {/* Mode switcher bar (Voice <-> Type) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/50">Mode:</span>
                    <div className="inline-flex p-1 bg-white/05 rounded-xl border border-white/10">
                      <button
                        type="button"
                        id="mode-toggle-voice"
                        onClick={() => setInputMode("voice")}
                        aria-pressed={inputMode === "voice"}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          inputMode === "voice"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        <span>🎤</span>
                        <span>Voice</span>
                      </button>
                      <button
                        type="button"
                        id="mode-toggle-text"
                        onClick={() => setInputMode("text")}
                        aria-pressed={inputMode === "text"}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          inputMode === "text"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        <span>⌨️</span>
                        <span>Type</span>
                      </button>
                    </div>
                  </div>

                  {conversation.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConversation([])}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors"
                      title="Clear chat messages"
                    >
                      Clear Conversation
                    </button>
                  )}
                </div>
              </div>

              {/* Voice Interface (Visible when Voice Mode is active) */}
              {inputMode === "voice" && (
                <div className="glass-card p-5 text-center">
                  {!isRecording ? (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        id="start-speaking-btn"
                        onClick={startListening}
                        disabled={isSubmitting}
                        className="btn-neon w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                      >
                        <span>🎤</span>
                        <span>Start Speaking Freely</span>
                      </button>
                      <p className="text-white/40 text-xs">
                        {selectedTopic
                          ? `Topic active: "${selectedTopic}" — Click to start speaking`
                          : "Speak on any daily situation in natural English"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-red-500/90 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                          </svg>
                        </div>
                        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-50" />
                      </div>

                      <div>
                        <p className="text-white font-semibold text-sm">Listening to your speech…</p>
                        <p className="text-white/50 text-xs">
                          {selectedTopic ? `Topic: ${selectedTopic}` : "Speak freely in English"}
                        </p>
                      </div>

                      {liveTranscript && (
                        <div className="bg-white/05 border border-white/10 rounded-xl p-3 max-w-lg w-full text-center">
                          <p className="text-white/80 text-sm italic font-sans">"{liveTranscript}"</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="stop-recording-btn"
                          onClick={stopListening}
                          className="btn-ghost px-6 py-2.5 rounded-xl text-sm font-medium border-red-500/30 text-red-300 hover:bg-red-500/20"
                        >
                          ■ Stop & Get Feedback
                        </button>
                        <button
                          type="button"
                          onClick={cancelListening}
                          className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-sm flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="text-red-300 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Conversation Area */}
              <div className="glass-card p-4 sm:p-6 min-h-[220px] max-h-[500px] overflow-y-auto space-y-4">
                {conversation.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center text-white/40 text-sm">
                    <span className="text-3xl mb-2">💬</span>
                    <p className="font-medium text-white/60 mb-1">No conversation yet</p>
                    <p className="text-xs max-w-md">
                      {inputMode === "voice"
                        ? "Click 'Start Speaking Freely' above or type a response in the box below to start practicing."
                        : "Type your response in the box below and press Send to start the conversation."}
                    </p>
                  </div>
                ) : (
                  conversation.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      {/* Speaker label & meta */}
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-white/40">
                          {msg.role === "user" ? "You" : "🤖 Coach"}
                        </span>
                        {msg.topic && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                            {msg.topic}
                          </span>
                        )}
                        <span className="text-[10px] text-white/30">{msg.timestamp}</span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md rounded-tr-sm"
                            : "bg-white/06 border border-white/12 text-white/90 shadow-sm rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {/* Listen button for coach response */}
                        {msg.role === "coach" && (
                          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(msg.id, msg.text)}
                              aria-label={speakingMessageId === msg.id ? "Stop audio" : "Listen to feedback"}
                              className="text-xs px-2.5 py-1 rounded-lg bg-white/08 hover:bg-white/15 text-white/80 transition-colors flex items-center gap-1.5"
                            >
                              <span>{speakingMessageId === msg.id ? "⏹" : "🔊"}</span>
                              <span>{speakingMessageId === msg.id ? "Stop" : "Listen"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}

                {/* AI Responding State */}
                {isSubmitting && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-white/40">🤖 Coach</span>
                      <span className="text-[10px] text-blue-400">Thinking…</span>
                    </div>
                    <div className="bg-white/06 border border-white/12 rounded-2xl rounded-tl-sm p-4 text-sm text-white/60 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span className="text-xs text-white/50">Analyzing & preparing guidance…</span>
                    </div>
                  </motion.div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* ── Bottom Text Input Bar ── */}
              <div
                className={`glass-card p-4 transition-all ${
                  inputMode === "text"
                    ? "border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.2)]"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="conversation-text-input"
                    className="text-white/70 text-xs font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <span>Or type your response here:</span>
                    {inputMode === "text" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                        Type Mode Active
                      </span>
                    )}
                  </label>

                  {isSubmitting && (
                    <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
                      Thinking...
                    </span>
                  )}
                </div>

                <div className="flex gap-2 sm:gap-3 items-center">
                  <div className="relative flex-1">
                    <input
                      id="conversation-text-input"
                      ref={textInputRef}
                      type="text"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (error) setError("");
                      }}
                      onFocus={() => {
                        if (inputMode !== "text") {
                          setInputMode("text");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleTextSubmit();
                        }
                      }}
                      placeholder="Or type your response here..."
                      disabled={isSubmitting}
                      aria-label="Or type your response here..."
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed border"
                      style={{
                        backgroundColor: "#f1f5f9",
                        color: "#0f172a",
                        borderColor: "rgba(59,130,246,0.35)",
                        caretColor: "#2563eb",
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    id="send-conversation-btn"
                    onClick={handleTextSubmit}
                    disabled={!message.trim() || isSubmitting || isSubmittingRef.current}
                    aria-label="Send response"
                    className="btn-neon px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex-shrink-0"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                        <span>Sending</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span>Send</span>
                        <span className="text-base leading-none">➤</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
