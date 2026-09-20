"use client";

/**
 * User Settings & Profile Configuration
 * Allows configuring personal learning preferences, mother tongue,
 * audio/speech engine options, and system connection diagnostics.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LANGUAGES } from "@/lib/languages";
import {
  getPreferences,
  savePreferences,
  UserPreferences,
  getProgress,
} from "@/store/userStore";

const EDUCATION_LEVELS = [
  { id: "school", label: "School Student (Class 8–12)" },
  { id: "college", label: "College / Undergraduate Student" },
  { id: "postgraduate", label: "Postgraduate / Master's Student" },
  { id: "job_seeker", label: "Job Seeker / Early Career" },
  { id: "professional", label: "Working Professional" },
];

const LEARNING_GOAL_OPTIONS = [
  { id: "interview", label: "Job & College Interview Prep", icon: "💼" },
  { id: "viva", label: "Viva & Oral Examinations", icon: "🎓" },
  { id: "presentation", label: "Presentations & Seminars", icon: "📊" },
  { id: "daily", label: "Daily Social Conversation", icon: "🗣️" },
  { id: "corporate", label: "Corporate Emails & Meetings", icon: "🏢" },
  { id: "pronunciation", label: "Pronunciation & Accent Neutrality", icon: "🎙️" },
];

const SPEECH_VOICES = [
  { id: "nova", label: "Nova (Warm & Friendly - Recommended)" },
  { id: "alloy", label: "Alloy (Neutral & Balanced)" },
  { id: "echo", label: "Echo (Deep & Confident)" },
  { id: "shimmer", label: "Shimmer (Expressive & Clear)" },
];

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPreferences>({
    educationLevel: "college",
    preferredLanguage: "hi",
    learningGoals: ["interview", "daily"],
    onboardingComplete: true,
    name: "",
  });

  const [speechVoice, setSpeechVoice] = useState("nova");
  const [speechSpeed, setSpeechSpeed] = useState("1.0");
  const [useBrowserTTSFallback, setUseBrowserTTSFallback] = useState(true);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    const current = getPreferences();
    setPrefs(current);

    // Check backend health
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ??
      process.env.NEXT_PUBLIC_SOCKET_URL ??
      "http://localhost:4000";

    fetch(`${backendUrl}/health`)
      .then((res) => {
        if (res.ok) setBackendStatus("online");
        else setBackendStatus("offline");
      })
      .catch(() => setBackendStatus("offline"));
  }, []);

  const handleToggleGoal = (goalId: string) => {
    setPrefs((prev) => {
      const exists = prev.learningGoals.includes(goalId);
      const nextGoals = exists
        ? prev.learningGoals.filter((g) => g !== goalId)
        : [...prev.learningGoals, goalId];
      return { ...prev, learningGoals: nextGoals };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    savePreferences(prefs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportData = () => {
    const exportData = {
      preferences: getPreferences(),
      progress: getProgress(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apni_awaaz_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMessage("Data exported successfully!");
    setTimeout(() => setExportMessage(null), 3000);
  };

  return (
    <div className="min-h-full w-full py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-3xl">⚙️</span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Settings & Personalization
          </h1>
        </div>
        <p className="text-white/50 text-sm mt-1">
          Customize your mother tongue, learning goals, voice feedback, and system settings.
        </p>
      </div>

      {/* ── Notification Toast ── */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-sm flex items-center gap-2"
        >
          <span>✓</span>
          <span>Preferences saved successfully! Changes are applied across all practice tools.</span>
        </motion.div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Profile & Identity ── */}
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>👤</span> Student Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Your Full Name or Nickname
              </label>
              <input
                type="text"
                value={prefs.name}
                onChange={(e) => setPrefs({ ...prefs, name: e.target.value })}
                placeholder="e.g., Anjali Sharma"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Education / Career Stage
              </label>
              <select
                value={prefs.educationLevel}
                onChange={(e) => setPrefs({ ...prefs, educationLevel: e.target.value })}
                className="w-full bg-[#0d0d1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60"
              >
                {EDUCATION_LEVELS.map((ed) => (
                  <option key={ed.id} value={ed.id} className="bg-[#0d0d1e]">
                    {ed.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Mother Tongue / Native Language
            </label>
            <p className="text-[11px] text-white/40 mb-2">
              The AI Coach uses this to anticipate native language sentence structure and translate smoothly to English.
            </p>
            <select
              value={prefs.preferredLanguage}
              onChange={(e) => setPrefs({ ...prefs, preferredLanguage: e.target.value })}
              className="w-full sm:w-80 bg-[#0d0d1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#0d0d1e]">
                  {lang.name} ({lang.nativeName}) — {lang.region}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Learning Goals ── */}
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🎯</span> Target Communication Goals
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Select what you want to improve so the AI Coach customizes interview scenarios and feedback.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {LEARNING_GOAL_OPTIONS.map((g) => {
              const isSelected = prefs.learningGoals.includes(g.id);
              return (
                <div
                  key={g.id}
                  onClick={() => handleToggleGoal(g.id)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center gap-3 ${
                    isSelected
                      ? "bg-blue-500/15 border-blue-500/40 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-xl">{g.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight">{g.label}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                      isSelected
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-white/20"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Audio & Speech Engine ── */}
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>🎙️</span> Audio & Speech Engine
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                AI Coach Voice Personality
              </label>
              <select
                value={speechVoice}
                onChange={(e) => setSpeechVoice(e.target.value)}
                className="w-full bg-[#0d0d1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60"
              >
                {SPEECH_VOICES.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#0d0d1e]">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Playback Speed
              </label>
              <select
                value={speechSpeed}
                onChange={(e) => setSpeechSpeed(e.target.value)}
                className="w-full bg-[#0d0d1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60"
              >
                <option value="0.85" className="bg-[#0d0d1e]">0.85x — Slower (Easier to catch accents)</option>
                <option value="1.0" className="bg-[#0d0d1e]">1.0x — Normal Natural Pace</option>
                <option value="1.15" className="bg-[#0d0d1e]">1.15x — Brisk (Advanced practice)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useBrowserTTSFallback}
                onChange={(e) => setUseBrowserTTSFallback(e.target.checked)}
                className="rounded accent-blue-600 w-4 h-4"
              />
              <span className="text-xs text-white/70">
                Allow browser Web Speech synthesis fallback if backend TTS stream is unavailable
              </span>
            </label>
          </div>
        </div>

        {/* ── System Status & Diagnostics ── */}
        <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>🔌</span> Server Connection & Health
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <div>
              <p className="text-xs font-semibold text-white">Backend Express + Socket Server</p>
              <p className="text-[11px] font-mono text-white/40">
                {process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-400 shadow-neon-sm"
                    : backendStatus === "checking"
                    ? "bg-amber-400 animate-ping"
                    : "bg-red-400"
                }`}
              />
              <span className="text-xs font-medium text-white/80 capitalize">
                {backendStatus === "online"
                  ? "Connected (Port 4000)"
                  : backendStatus === "checking"
                  ? "Checking..."
                  : "Offline / Port 4000 not started"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Backup & Storage ── */}
        <div className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Data & Offline Backup</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Download your practice streaks, vocabulary list, and preferences as JSON.
            </p>
            {exportMessage && (
              <p className="text-xs text-emerald-400 font-semibold mt-1">{exportMessage}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportData}
            className="px-4 py-2 bg-white/05 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white transition-all self-start sm:self-auto"
          >
            Export Backup (.json)
          </button>
        </div>

        {/* ── Form Save Button ── */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/25"
          >
            Save All Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
