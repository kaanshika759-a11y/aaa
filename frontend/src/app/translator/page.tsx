"use client";

/**
 * Translator Page – Multilingual translation with Mother Language → Confident English
 * Powered by SUPPORTED_LANGUAGES (22 Indian Languages + English) & speechService
 */

import { motion } from "framer-motion";
import Translator from "@/components/Translator";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";

const POPULAR_PAIRS = [
  { from: "hi-IN", to: "en-IN", fromName: "Hindi", toName: "English" },
  { from: "ta-IN", to: "en-IN", fromName: "Tamil", toName: "English" },
  { from: "bn-IN", to: "en-IN", fromName: "Bengali", toName: "English" },
  { from: "te-IN", to: "en-IN", fromName: "Telugu", toName: "English" },
  { from: "mr-IN", to: "en-IN", fromName: "Marathi", toName: "English" },
  { from: "gu-IN", to: "en-IN", fromName: "Gujarati", toName: "English" },
];

export default function TranslatorPage() {
  return (
    <div className="relative min-h-full w-full overflow-x-hidden bg-slate-950 py-8 px-4 lg:px-8">

      {/* Subtle Cyan / Blue Glow Orbs */}
      <div
        className="pointer-events-none absolute w-[500px] h-[500px] -top-32 -right-32 opacity-20 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute w-[400px] h-[400px] bottom-10 -left-24 opacity-15 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center sm:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
            <span>🇮🇳</span> 22 Scheduled Indian Languages + English Supported
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
            Multilingual Voice & Text Translator
          </h1>
          <p className="text-white/60 text-sm sm:text-base max-w-2xl leading-relaxed">
            Express yourself freely in your mother tongue. Get natural, confident, and professional English versions with clear voice pronunciation.
          </p>
        </motion.div>

        {/* Main Translator Widget */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Translator />
        </motion.div>

        {/* Quick Language Highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 backdrop-blur-sm"
        >
          <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
            Scheduled Indian Languages Supported
          </h3>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((l) => (
              <span
                key={l.code}
                className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 transition"
              >
                <span className="font-medium text-slate-100">{l.name}</span>{" "}
                <span className="text-slate-400 font-normal">({l.nativeName})</span>
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
