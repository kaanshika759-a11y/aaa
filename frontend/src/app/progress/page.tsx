"use client";

/**
 * Progress & Confidence Analytics Dashboard
 * Visualizes speaking time, streaks, milestones/badges,
 * recent session history, and skill growth.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  getProgress,
  getPreferences,
  formatDuration,
  Progress,
  UserPreferences,
  saveProgress,
} from "@/store/userStore";

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: (p: Progress) => boolean;
  progressPercent: (p: Progress) => number;
}

const MILESTONES: Milestone[] = [
  {
    id: "first_voice",
    title: "First Words",
    description: "Complete your first speaking or coaching session",
    icon: "🌱",
    isUnlocked: (p) => p.totalSessions >= 1,
    progressPercent: (p) => Math.min(100, Math.round((p.totalSessions / 1) * 100)),
  },
  {
    id: "consistency_3",
    title: "3-Day Fire Streak",
    description: "Practice for 3 consecutive days",
    icon: "🔥",
    isUnlocked: (p) => p.streak >= 3,
    progressPercent: (p) => Math.min(100, Math.round((p.streak / 3) * 100)),
  },
  {
    id: "vocal_warrior",
    title: "Vocal Marathon",
    description: "Accumulate 10 minutes of speaking time",
    icon: "🎙️",
    isUnlocked: (p) => p.totalSpeakingSeconds >= 600,
    progressPercent: (p) => Math.min(100, Math.round((p.totalSpeakingSeconds / 600) * 100)),
  },
  {
    id: "vocab_collector",
    title: "Vocabulary Maestro",
    description: "Learn and master 10 high-impact words",
    icon: "📚",
    isUnlocked: (p) => p.vocabularyLearned >= 10,
    progressPercent: (p) => Math.min(100, Math.round((p.vocabularyLearned / 10) * 100)),
  },
  {
    id: "interview_ready",
    title: "Career Confident",
    description: "Complete 5 mock practice or interview sessions",
    icon: "💼",
    isUnlocked: (p) => p.completedChallenges >= 5 || p.totalSessions >= 5,
    progressPercent: (p) =>
      Math.min(100, Math.round(((p.completedChallenges + p.totalSessions) / 5) * 100)),
  },
  {
    id: "multilingual_bridge",
    title: "Language Master",
    description: "Use translation & nuance conversion 15 times",
    icon: "🌐",
    isUnlocked: (p) => p.translationCount >= 15,
    progressPercent: (p) => Math.min(100, Math.round((p.translationCount / 15) * 100)),
  },
];

export default function ProgressPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setProgress(getProgress());
    setPrefs(getPreferences());
  }, []);

  const handleResetProgress = () => {
    const emptyProgress: Progress = {
      totalSessions: 0,
      totalSpeakingSeconds: 0,
      completedChallenges: 0,
      vocabularyLearned: 0,
      conversationSessions: 0,
      translationCount: 0,
      lastActiveDate: "",
      sessions: [],
      streak: 0,
    };
    saveProgress(emptyProgress);
    setProgress(emptyProgress);
    setShowResetConfirm(false);
  };

  if (!progress) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const unlockedCount = MILESTONES.filter((m) => m.isUnlocked(progress)).length;

  return (
    <div className="min-h-full w-full py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">📈</span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Learning Progress & Confidence
            </h1>
          </div>
          <p className="text-white/50 text-sm mt-1">
            {prefs?.name ? `Welcome back, ${prefs.name}! ` : ""}
            Track your speaking milestones, consistency streak, and skill development.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
          >
            <span>🎯</span> Start Practice
          </Link>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-2 rounded-xl bg-white/05 hover:bg-white/10 text-white/40 hover:text-white/70 text-xs transition-all border border-white/08"
            title="Reset statistics"
          >
            Reset Stats
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Streak */}
        <div className="glass-card p-4 rounded-2xl border border-orange-500/20 bg-orange-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">🔥</span>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
              Streak
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {progress.streak} <span className="text-xs font-normal text-white/50">days</span>
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            {progress.streak > 0 ? "Keep the fire alive!" : "Practice today to start"}
          </p>
        </div>

        {/* Total Speaking Time */}
        <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">🎙️</span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Spoken
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {formatDuration(progress.totalSpeakingSeconds)}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Active microphone time</p>
        </div>

        {/* Sessions Completed */}
        <div className="glass-card p-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">🎯</span>
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
              Sessions
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {progress.totalSessions}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Practice drills completed</p>
        </div>

        {/* Challenges Won */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">🏆</span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Challenges
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {progress.completedChallenges}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Daily challenges beaten</p>
        </div>

        {/* Vocabulary */}
        <div className="glass-card p-4 rounded-2xl border border-pink-500/20 bg-pink-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">📚</span>
            <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">
              Vocab
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {progress.vocabularyLearned}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Words & phrases mastered</p>
        </div>

        {/* Translations */}
        <div className="glass-card p-4 rounded-2xl border border-teal-500/20 bg-teal-500/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xl">🌐</span>
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
              Nuance
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-display text-white mt-2">
            {progress.translationCount}
          </p>
          <p className="text-[11px] text-white/40 mt-1">Phrases translated</p>
        </div>
      </div>

      {/* ── Confidence Growth Overview ── */}
      <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🚀</span> Confidence & Fluency Trajectory
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Based on your session frequency, speech flow, and consistency.
            </p>
          </div>
          <div className="text-xs text-white/60 bg-white/05 px-3 py-1.5 rounded-xl border border-white/08">
            Skill Tier:{" "}
            <span className="text-blue-400 font-semibold">
              {progress.totalSessions > 15
                ? "Articulate Communicator"
                : progress.totalSessions > 5
                ? "Emerging Speaker"
                : "Foundational Learner"}
            </span>
          </div>
        </div>

        {/* Skill Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Fluency & Pace */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 font-medium">Fluency & Pace</span>
              <span className="text-blue-400 font-semibold">
                {Math.min(95, Math.max(35, progress.totalSessions * 8 + 30))}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/08 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(95, Math.max(35, progress.totalSessions * 8 + 30))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-white/40">
              Reduces pauses and hesitation through repetition drills.
            </p>
          </div>

          {/* Vocabulary & Clarity */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 font-medium">Vocabulary & Clarity</span>
              <span className="text-purple-400 font-semibold">
                {Math.min(95, Math.max(40, progress.vocabularyLearned * 6 + 35))}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/08 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(95, Math.max(40, progress.vocabularyLearned * 6 + 35))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-white/40">
              Replaces repetitive words with precise corporate & interview terms.
            </p>
          </div>

          {/* Interview & Presentation Readiness */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 font-medium">Interview Readiness</span>
              <span className="text-emerald-400 font-semibold">
                {Math.min(98, Math.max(25, progress.completedChallenges * 15 + 20))}%
              </span>
            </div>
            <div className="h-2 w-full bg-white/08 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(98, Math.max(25, progress.completedChallenges * 15 + 20))}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-white/40">
              Assesses structured storytelling and prompt response confidence.
            </p>
          </div>
        </div>
      </div>

      {/* ── Milestones & Achievements ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🏅</span> Milestones & Badges
            </h2>
            <p className="text-xs text-white/50">
              {unlockedCount} of {MILESTONES.length} badges unlocked
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MILESTONES.map((m) => {
            const unlocked = m.isUnlocked(progress);
            const percent = m.progressPercent(progress);

            return (
              <div
                key={m.id}
                className={`p-5 rounded-2xl glass-card border transition-all ${
                  unlocked
                    ? "border-amber-500/30 bg-amber-500/[0.03]"
                    : "border-white/[0.06] opacity-60"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                      unlocked
                        ? "bg-amber-500/20 border border-amber-500/40 shadow-neon-sm"
                        : "bg-white/05 border border-white/10"
                    }`}
                  >
                    {m.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-bold text-white truncate">
                        {m.title}
                      </h3>
                      {unlocked && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                          Unlocked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-1 leading-snug">
                      {m.description}
                    </p>

                    {!unlocked && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-white/40">
                          <span>Progress</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/08 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Practice Session Log ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📜</span> Recent Practice Activity
        </h2>

        {progress.sessions.length === 0 ? (
          <div className="glass-card p-8 rounded-2xl border border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/05 flex items-center justify-center mx-auto text-xl text-white/40">
              🎙️
            </div>
            <p className="text-sm text-white/70 font-medium">No practice sessions recorded yet.</p>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              Start an AI Coach conversation, camera practice, or daily challenge to automatically record your speaking stats!
            </p>
            <div className="pt-2">
              <Link
                href="/coach"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
              >
                <span>🤖</span> Talk with AI Coach
              </Link>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {progress.sessions.slice(0, 10).map((session, idx) => (
                <div
                  key={idx}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {session.type === "voice"
                        ? "🎙️"
                        : session.type === "camera"
                        ? "📷"
                        : session.type === "daily"
                        ? "🔥"
                        : "🎯"}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-white capitalize">
                        {session.type} Practice Drill
                      </p>
                      <p className="text-[11px] text-white/40">{session.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/70">
                    <span className="bg-white/05 px-2.5 py-1 rounded-lg">
                      ⏱️ {formatDuration(session.durationSeconds)}
                    </span>
                    {session.wordsSpoken > 0 && (
                      <span className="bg-white/05 px-2.5 py-1 rounded-lg">
                        💬 {session.wordsSpoken} words
                      </span>
                    )}
                    {session.messagesCount > 0 && (
                      <span className="bg-white/05 px-2.5 py-1 rounded-lg">
                        🗨️ {session.messagesCount} msgs
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Confirmation Modal for Reset ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-red-500/30 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">Reset All Progress?</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              This will clear your speaking time, streaks, milestones, and session history stored in this browser.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-white/70 bg-white/05 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
