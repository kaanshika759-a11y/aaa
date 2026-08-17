"use client";

/**
 * ConfidenceScore – Sidebar card showing a mock/live confidence score.
 *
 * In production, wire this to the `buildConfidenceAnalysis` endpoint
 * returned by the backend after each session completes.
 */

import { motion } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "coach";
  text: string;
  timestamp: Date;
}

interface ConfidenceScoreProps {
  messages: Message[];
}

// Heuristic: more messages = higher mock score (replace with real backend data)
function deriveScore(messages: Message[]): number {
  const userMessages = messages.filter((m) => m.role === "user").length;
  return Math.min(10, 4 + userMessages * 0.8);
}

const METRICS = [
  { key: "Clarity",      icon: "💡" },
  { key: "Confidence",   icon: "🔥" },
  { key: "Pace",         icon: "⚡" },
  { key: "Engagement",   icon: "✨" },
];

export default function ConfidenceScore({ messages }: ConfidenceScoreProps) {
  const score = deriveScore(messages);
  const pct = (score / 10) * 100;
  const hasData = messages.length > 0;

  return (
    <div className="glass-card w-full p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/70">Confidence Score</h2>
        {hasData && (
          <span className="text-xs font-mono text-white/30">Live</span>
        )}
      </div>

      {/* Score ring */}
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            {/* Track */}
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="7"
            />
            {/* Progress */}
            <motion.circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="url(#scoreGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{
                strokeDashoffset: hasData
                  ? (2 * Math.PI * 34) * (1 - pct / 100)
                  : 2 * Math.PI * 34,
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0062ff" />
                <stop offset="100%" stopColor="#00eeff" />
              </linearGradient>
            </defs>
          </svg>
          {/* Score number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={score.toFixed(1)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xl font-bold font-display text-neon-glow"
              style={{ color: "#0062ff" }}
            >
              {hasData ? score.toFixed(1) : "—"}
            </motion.span>
          </div>
        </div>

        {/* Metrics list */}
        <div className="flex-1 space-y-2">
          {METRICS.map((m, i) => (
            <div key={m.key} className="flex items-center gap-2">
              <span className="text-xs">{m.icon}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/05 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #0062ff, #00eeff)",
                    boxShadow: "0 0 6px rgba(0,98,255,0.5)",
                  }}
                  initial={{ width: 0 }}
                  animate={{
                    width: hasData ? `${Math.min(100, pct - i * 5 + i * 7)}%` : "0%",
                  }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
                />
              </div>
              <span className="text-[10px] text-white/30 font-mono w-6 text-right">
                {hasData ? Math.round(Math.min(10, score - i * 0.3 + i * 0.5)) : "–"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!hasData && (
        <p className="text-xs text-white/25 text-center">
          Scores appear after your first session
        </p>
      )}
    </div>
  );
}
