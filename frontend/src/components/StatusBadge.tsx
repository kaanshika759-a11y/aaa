"use client";

/**
 * StatusBadge – Connection & app-state indicator in the header.
 */

import { motion, AnimatePresence } from "framer-motion";

interface StatusBadgeProps {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
  isConnected: boolean;
}

const stateConfig = {
  idle:      { label: "Ready",      color: "#22d3ee", dot: "#22d3ee" },
  listening: { label: "Listening",  color: "#0062ff", dot: "#0062ff" },
  thinking:  { label: "Thinking",   color: "#f59e0b", dot: "#f59e0b" },
  speaking:  { label: "Speaking",   color: "#a855f7", dot: "#a855f7" },
  error:     { label: "Error",      color: "#f87171", dot: "#f87171" },
};

export default function StatusBadge({ state, isConnected }: StatusBadgeProps) {
  const cfg = stateConfig[state];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state + String(isConnected)}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          background: `${cfg.color}12`,
          border: `1px solid ${cfg.color}30`,
        }}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2">
          {(state === "listening" || state === "speaking") && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: cfg.dot }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: cfg.dot }}
          />
        </span>
        <span className="text-xs font-medium" style={{ color: cfg.color }}>
          {isConnected ? cfg.label : "Offline"}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
