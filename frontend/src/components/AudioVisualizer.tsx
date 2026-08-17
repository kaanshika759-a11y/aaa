"use client";

/**
 * AudioVisualizer – Neon-blue glow equalizer that reacts to voice input.
 *
 * Props:
 *   isActive   – whether mic or TTS playback is in progress
 *   audioLevel – 0–1 normalised RMS amplitude from the Web Audio analyser
 *   appState   – overall app state, used to colour the bars differently
 */

import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isActive: boolean;
  audioLevel: number; // 0–1
  appState: "idle" | "listening" | "thinking" | "speaking" | "error";
}

// Number of equalizer bars
const BAR_COUNT = 28;

export default function AudioVisualizer({
  isActive,
  audioLevel,
  appState,
}: AudioVisualizerProps) {
  // Pick accent colour based on state
  const accent =
    appState === "listening"
      ? { from: "#0062ff", to: "#00eeff", shadow: "rgba(0,98,255,0.6)" }
      : appState === "speaking"
      ? { from: "#a855f7", to: "#ec4899", shadow: "rgba(168,85,247,0.6)" }
      : appState === "thinking"
      ? { from: "#f59e0b", to: "#f97316", shadow: "rgba(245,158,11,0.5)" }
      : { from: "#1e293b", to: "#334155", shadow: "transparent" };

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center"
      style={{
        height: 260,
        background:
          "linear-gradient(160deg, rgba(0,98,255,0.06) 0%, rgba(168,85,247,0.04) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: isActive
          ? `0 0 48px ${accent.shadow}, inset 0 1px 0 rgba(255,255,255,0.07)`
          : "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* Corner glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${accent.shadow} 0%, transparent 70%)`,
            opacity: audioLevel * 0.8 + 0.2,
            transition: "opacity 0.1s ease",
          }}
        />
      )}

      {/* ── Equalizer Bars ── */}
      <div className="flex items-end gap-[3px] h-28 z-10">
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          // Each bar has a base animated height; boost when active
          const baseDelay = (i / BAR_COUNT) * 0.7;
          const height = isActive
            ? 20 + audioLevel * 80 + Math.sin(i * 0.7) * audioLevel * 30
            : 8;

          return (
            <motion.div
              key={i}
              animate={{
                height: isActive
                  ? [height, height * 0.4 + 8, height]
                  : [8, 12, 8],
                opacity: isActive ? [0.7, 1, 0.7] : [0.2, 0.3, 0.2],
              }}
              transition={{
                duration: isActive ? 0.5 + (i % 5) * 0.08 : 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: baseDelay,
              }}
              style={{
                width: 5,
                borderRadius: 3,
                background: `linear-gradient(to top, ${accent.from}, ${accent.to})`,
                boxShadow: isActive
                  ? `0 0 6px ${accent.shadow}, 0 0 12px ${accent.shadow}`
                  : "none",
                transition: "box-shadow 0.3s ease",
                transformOrigin: "bottom",
              }}
            />
          );
        })}
      </div>

      {/* ── Center label ── */}
      <motion.div
        className="mt-6 z-10 text-center"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {appState === "idle" && (
          <p className="text-xs font-mono text-white/30 tracking-widest uppercase">
            Ready
          </p>
        )}
        {appState === "listening" && (
          <p
            className="text-xs font-mono tracking-widest uppercase font-semibold"
            style={{ color: accent.from, textShadow: `0 0 8px ${accent.from}` }}
          >
            ● Listening
          </p>
        )}
        {appState === "thinking" && (
          <p
            className="text-xs font-mono tracking-widest uppercase font-semibold"
            style={{ color: "#f59e0b", textShadow: "0 0 8px rgba(245,158,11,0.6)" }}
          >
            ◌ Processing
          </p>
        )}
        {appState === "speaking" && (
          <p
            className="text-xs font-mono tracking-widest uppercase font-semibold"
            style={{ color: "#a855f7", textShadow: "0 0 8px rgba(168,85,247,0.6)" }}
          >
            ▶ Coach Speaking
          </p>
        )}
        {appState === "error" && (
          <p className="text-xs font-mono text-red-400 tracking-widest uppercase">
            ✕ Error
          </p>
        )}
      </motion.div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0px, transparent 1px, transparent 20px)",
        }}
      />
    </div>
  );
}
