"use client";

/**
 * CoachMessage – Glassmorphic card that renders the AI coach's reply.
 * Supports streaming mode (typewriter cursor) and completed mode.
 */

import { motion } from "framer-motion";

interface CoachMessageProps {
  text: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

export default function CoachMessage({
  text,
  timestamp,
  isStreaming = false,
}: CoachMessageProps) {
  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-neon-sm">
        <span className="text-sm">🤖</span>
      </div>

      <div className="flex-1 max-w-[85%]">
        <p className="text-[11px] text-white/30 mb-1 font-medium ml-1">ApniAwaaz</p>

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
