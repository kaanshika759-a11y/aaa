"use client";

/**
 * CoachMessage – Glassmorphic card that renders the AI coach's reply.
 * Supports streaming mode (typewriter cursor), completed mode, and a speaker replay button.
 */

import { motion } from "framer-motion";

interface CoachMessageProps {
  text: string;
  timestamp?: Date;
  isStreaming?: boolean;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

export default function CoachMessage({
  text,
  timestamp,
  isStreaming = false,
  onSpeak,
  isSpeaking = false,
}: CoachMessageProps) {
  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-neon-sm">
        <span className="text-sm">🤖</span>
      </div>

      <div className="flex-1 max-w-[85%]">
        <div className="flex items-center justify-between mb-1 ml-1 pr-1">
          <p className="text-[11px] text-white/30 font-medium">ApniAwaaz Coach</p>
          {!isStreaming && text && onSpeak && (
            <button
              onClick={() => onSpeak(text)}
              title={isSpeaking ? "Stop speech" : "Read aloud"}
              className={`text-xs px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                isSpeaking
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-slate-700"
              }`}
            >
              <span>{isSpeaking ? "⏹️ Stop" : "🔊 Listen"}</span>
            </button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-card-neon px-5 py-4 text-sm text-white/90 leading-relaxed"
        >
          {text}
          {isStreaming && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="inline-block ml-0.5 w-0.5 h-4 bg-blue-400 align-middle"
            />
          )}
        </motion.div>

        {timestamp && !isStreaming && (
          <p className="text-[10px] text-white/20 mt-1 ml-1 font-mono">
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
