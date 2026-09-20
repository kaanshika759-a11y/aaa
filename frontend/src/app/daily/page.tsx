"use client";

/**
 * Daily Confidence Challenge Page
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDailyChallenge, getPracticeFeedback, DailyChallenge } from "@/services/api";
import { recordSession, getProgress, formatDuration } from "@/store/userStore";

type ChallengeState = "loading" | "ready" | "recording" | "processing" | "feedback" | "error";

export default function DailyChallengePage() {
  const [state, setState] = useState<ChallengeState>("loading");
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [date, setDate] = useState("");
  const [timer, setTimer] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [streak, setStreak] = useState(0);
  const [totalChallenges, setTotalChallenges] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const prog = getProgress();
    setStreak(prog.streak);
    setTotalChallenges(prog.completedChallenges);
    loadChallenge();
  }, []);

  const loadChallenge = async () => {
    setState("loading");
    setError("");
    try {
      const res = await getDailyChallenge();
      setChallenge(res.challenge);
      setDate(res.date);
      setState("ready");
    } catch {
      setState("error");
      setError("Could not load today's challenge. Check your backend connection.");
    }
  };

  const startChallenge = useCallback(() => {
    if (!challenge) return;
    setTranscript("");
    setLiveTranscript("");
    setFeedback("");
    setTimer(0);
    setState("recording");

    // Timer
    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);

    // Speech recognition
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Voice recognition not supported. Please use Chrome or Edge.");
      setState("ready");
      return;
    }

    const SpeechRecognitionAPI =
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
      window.SpeechRecognition;

    const rec = new SpeechRecognitionAPI();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim = t;
      }
      setLiveTranscript(finalText + interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") setError("Microphone permission denied.");
    };

    rec.onend = () => setTranscript(finalText.trim());

    rec.start();
  }, [challenge]);

  const stopChallenge = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recognitionRef.current?.stop();

    const finalText = transcript || liveTranscript;
    if (finalText.trim()) {
      submitChallenge(finalText.trim());
    } else {
      setError("No speech detected. Try again!");
      setState("ready");
    }
  }, [transcript, liveTranscript]);

  const submitChallenge = async (text: string) => {
    setState("processing");
    setTranscript(text);

    try {
      const res = await getPracticeFeedback(text, "daily-conversation", challenge?.title ?? "");
      setFeedback(res.feedback);
      setState("feedback");

      recordSession({
        date: new Date().toDateString(),
        type: "daily",
        durationSeconds: timer,
        wordsSpoken: text.split(" ").length,
        messagesCount: 1,
      });

      const prog = getProgress();
      setStreak(prog.streak);
      setTotalChallenges(prog.completedChallenges);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to get feedback.");
      setState("ready");
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const targetTime = challenge?.duration ?? 60;
  const pct = Math.min(100, (timer / targetTime) * 100);

  return (
    <div className="relative min-h-full w-full bg-[#03030a] py-8 px-4 lg:px-8">
      <div className="orb w-[500px] h-[500px] -top-32 -right-32 opacity-15"
        style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }} />

      <div className="relative z-10 max-w-4xl mx-auto w-full">


        {/* Header with stats */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="font-display font-bold text-3xl text-white mb-1">🔥 Daily Challenge</h1>
              <p className="text-white/50 text-sm">{date}</p>
            </div>
            <div className="flex gap-4">
              <div className="glass-card px-4 py-3 text-center">
                <p className="text-amber-400 text-2xl font-bold">{streak}</p>
                <p className="text-white/40 text-xs">Day Streak</p>
              </div>
              <div className="glass-card px-4 py-3 text-center">
                <p className="text-emerald-400 text-2xl font-bold">{totalChallenges}</p>
                <p className="text-white/40 text-xs">Completed</p>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Loading */}
          {state === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <span className="text-3xl animate-spin">⚡</span>
              </div>
              <p className="text-white/50">Loading today's challenge…</p>
            </motion.div>
          )}

          {/* Error */}
          {state === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass-card border-red-500/30 p-6 text-center">
              <p className="text-red-400 mb-4">⚠️ {error}</p>
              <button onClick={loadChallenge} className="btn-neon px-6 py-2 rounded-xl text-sm">Retry</button>
            </motion.div>
          )}

          {/* Ready */}
          {state === "ready" && challenge && (
            <motion.div key="ready" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-5">

              {/* Challenge card */}
              <div className="glass-card-neon p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl shadow-lg">
                    🎯
                  </div>
                  <div>
                    <p className="text-orange-400 text-xs uppercase tracking-wider">Today's Challenge</p>
                    <h2 className="text-white font-bold text-xl">{challenge.title}</h2>
                  </div>
                </div>

                <p className="text-white/75 leading-relaxed mb-4">{challenge.prompt}</p>

                <div className="flex items-center gap-4 text-sm text-white/40">
                  <span>⏱ {formatTime(challenge.duration)} speaking time</span>
                  <span className="capitalize">· {challenge.category.replace("-", " ")}</span>
                </div>
              </div>

              {/* Tips */}
              {challenge.tips?.length > 0 && (
                <div className="glass-card p-5">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-3">💡 Tips</p>
                  <ul className="space-y-2">
                    {challenge.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                id="start-challenge-btn"
                onClick={startChallenge}
                className="btn-neon w-full py-4 rounded-2xl text-base flex items-center justify-center gap-3"
              >
                <span>🎤</span>
                Accept Challenge
              </button>
            </motion.div>
          )}

          {/* Recording */}
          {state === "recording" && challenge && (
            <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-6">

              {/* Circular timer */}
              <div className="flex flex-col items-center py-8 gap-6">
                <div className="relative w-40 h-40">
                  <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle
                      cx="80" cy="80" r="68" fill="none"
                      stroke="url(#timerGrad)" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 68}`}
                      strokeDashoffset={`${2 * Math.PI * 68 * (1 - pct / 100)}`}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                    <defs>
                      <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-white font-mono text-3xl font-bold">{formatTime(timer)}</p>
                    <p className="text-white/40 text-xs">/{formatTime(targetTime)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-white font-medium">Recording…</p>
                </div>
              </div>

              {/* Live transcript */}
              {liveTranscript && (
                <div className="glass-card p-4">
                  <p className="text-xs text-white/40 mb-1">Live:</p>
                  <p className="text-white/70 text-sm italic">{liveTranscript}</p>
                </div>
              )}

              <button
                id="stop-challenge-btn"
                onClick={stopChallenge}
                className="w-full py-4 rounded-2xl bg-red-500/80 text-white hover:bg-red-500 transition-colors"
              >
                ■ Stop & Submit
              </button>
            </motion.div>
          )}

          {/* Processing */}
          {state === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center animate-bounce">
                🤖
              </div>
              <p className="text-white/60">Analyzing your response…</p>
            </motion.div>
          )}

          {/* Feedback */}
          {state === "feedback" && (
            <motion.div key="feedback" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-5">

              {/* Completion banner */}
              <div className="glass-card p-5 border-emerald-500/20 text-center">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-emerald-400 font-bold text-lg">Challenge Completed!</p>
                <p className="text-white/50 text-sm mt-1">
                  You spoke for {formatDuration(timer)} · {streak} day streak 🔥
                </p>
              </div>

              {/* Transcript */}
              <div className="glass-card p-4">
                <p className="text-xs text-white/40 mb-2">What you said:</p>
                <p className="text-white/70 text-sm italic">"{transcript}"</p>
              </div>

              {/* Feedback */}
              <div className="glass-card-neon p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">🤖</div>
                  <p className="text-white font-semibold">Coach Feedback</p>
                </div>
                <p className="text-white/85 text-sm leading-relaxed whitespace-pre-line">{feedback}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={startChallenge}
                  className="btn-ghost flex-1 py-3 rounded-xl text-sm">
                  🎤 Try Again
                </button>
                <button onClick={loadChallenge}
                  className="btn-neon flex-1 py-3 rounded-xl text-sm">
                  Next Challenge
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

