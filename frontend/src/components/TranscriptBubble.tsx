"use client";

/**
 * TranscriptBubble – User speech bubble (right-aligned).
 * Shows interim live transcript in a faded / shimmer state.
 */

import { motion } from "framer-motion";

interface TranscriptBubbleProps {
  text: string;
  timestamp?: Date;
  isLive?: boolean; // true while still streaming (interim transcript)
}

export default function TranscriptBubble({
  text,
  timestamp,
  isLive = false,
}: TranscriptBubbleProps) {
  return (
    <div className="flex items-start gap-3 flex-row-reverse group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center border border-white/10">
        <span className="text-sm">🎙️</span>
      </div>

      <div className="flex-1 max-w-[80%] flex flex-col items-end">
        <p className="text-[11px] text-white/30 mb-1 font-medium mr-1">You</p>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`
            px-5 py-4 rounded-2xl text-sm leading-relaxed max-w-full
            ${isLive
              ? "border border-white/10 text-white/50 shimmer"
              : "glass-card text-white/85"
            }
          `}
          style={
            !isLive
              ? {
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
                }
              : {}
          }
        >
          {text}
          {isLive && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block ml-0.5 w-0.5 h-4 bg-white/40 align-middle"
            />
          )}
        </motion.div>

        {timestamp && !isLive && (
          <p className="text-[10px] text-white/20 mt-1 mr-1 font-mono">
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
