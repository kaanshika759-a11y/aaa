"use client";

/**
 * Onboarding Page – Student personalization wizard
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { EDUCATION_LEVELS, LEARNING_GOALS } from "@/lib/practiceTopics";
import { LANGUAGES, Language } from "@/lib/languages";
import { savePreferences } from "@/store/userStore";

const STEPS = ["welcome", "education", "language", "goals", "complete"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("hi");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

  const next = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const finish = () => {
    savePreferences({
      name: name.trim() || "Student",
      educationLevel,
      preferredLanguage,
      learningGoals: selectedGoals,
      onboardingComplete: true,
    });
    router.push("/");
  };

  // Languages sorted to show popular ones first
  const popularLangs = ["hi", "ta", "bn", "mr", "te", "kn", "ml", "gu", "pa", "ur"];
  const sortedLangs = LANGUAGES.filter((l: Language) => l.code !== "en").sort((a: Language, b: Language) => {
    const ai = popularLangs.indexOf(a.code);
    const bi = popularLangs.indexOf(b.code);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="relative min-h-full w-full bg-[#03030a] flex flex-col items-center justify-center px-4 py-12">

      <div className="orb w-[600px] h-[600px] -top-48 -left-48 opacity-15"
        style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }} />
      <div className="orb w-[400px] h-[400px] bottom-0 -right-32 opacity-10"
        style={{ background: "radial-gradient(circle, #0062ff 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Progress bar */}
        {step !== "welcome" && step !== "complete" && (
          <div className="mb-8">
            <div className="h-1 bg-white/08 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-white/30 text-xs mt-2 text-right">
              Step {stepIndex} of {STEPS.length - 2}
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Welcome ── */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-neon-md">
                <span className="text-4xl">🎙️</span>
              </div>
              <h1 className="font-display font-bold text-4xl text-white mb-4">
                Welcome to ApniAwaaz!
              </h1>
              <p className="text-white/60 text-lg mb-2">
                Your personal AI English Confidence Coach.
              </p>
              <p className="text-white/40 mb-8 max-w-sm mx-auto leading-relaxed">
                Let's personalize your experience. It takes just 2 minutes and makes a big difference!
              </p>

              <div className="mb-6">
                <label className="block text-white/50 text-sm mb-2">What should we call you?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  id="onboarding-name"
                  className="w-full bg-white/05 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg placeholder-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <button
                id="onboarding-start-btn"
                onClick={next}
                className="btn-neon w-full py-4 rounded-2xl text-base"
              >
                Let's Get Started →
              </button>
            </motion.div>
          )}

          {/* ── Education ── */}
          {step === "education" && (
            <motion.div
              key="education"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                What is your education level?
              </h2>
              <p className="text-white/50 mb-6">We'll personalize the practice topics for you.</p>

              <div className="space-y-3 mb-8">
                {EDUCATION_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    id={`edu-${level.id}`}
                    onClick={() => setEducationLevel(level.id)}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                      educationLevel === level.id
                        ? "bg-blue-500/20 border-blue-500/50 text-white"
                        : "bg-white/04 border-white/08 text-white/60 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("welcome")} className="btn-ghost px-6 py-3 rounded-xl">Back</button>
                <button
                  onClick={next}
                  disabled={!educationLevel}
                  className="btn-neon flex-1 py-3 rounded-xl disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Language ── */}
          {step === "language" && (
            <motion.div
              key="language"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                What is your preferred language?
              </h2>
              <p className="text-white/50 mb-6">
                You can practice in English and also use this language with the AI coach.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-6 max-h-72 overflow-y-auto pr-1">
                {sortedLangs.map((lang: Language) => (
                  <button
                    key={lang.code}
                    id={`lang-${lang.code}`}
                    onClick={() => setPreferredLanguage(lang.code)}
                    className={`px-4 py-3 rounded-xl text-sm text-left border transition-all ${
                      preferredLanguage === lang.code
                        ? "bg-violet-500/20 border-violet-500/50 text-white"
                        : "bg-white/04 border-white/08 text-white/60 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="block font-medium">{lang.nativeName}</span>
                    <span className="text-xs text-white/40">{lang.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("education")} className="btn-ghost px-6 py-3 rounded-xl">Back</button>
                <button onClick={next} className="btn-neon flex-1 py-3 rounded-xl">Continue →</button>
              </div>
            </motion.div>
          )}

          {/* ── Goals ── */}
          {step === "goals" && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                What do you want to improve?
              </h2>
              <p className="text-white/50 mb-6">Select all that apply.</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {LEARNING_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    id={`goal-${goal.id}`}
                    onClick={() => toggleGoal(goal.id)}
                    className={`px-4 py-4 rounded-xl text-sm border transition-all flex items-center gap-3 ${
                      selectedGoals.includes(goal.id)
                        ? "bg-emerald-500/20 border-emerald-500/50 text-white"
                        : "bg-white/04 border-white/08 text-white/60 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="text-xl">{goal.icon}</span>
                    <span>{goal.label}</span>
                    {selectedGoals.includes(goal.id) && <span className="ml-auto text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("language")} className="btn-ghost px-6 py-3 rounded-xl">Back</button>
                <button
                  onClick={next}
                  disabled={selectedGoals.length === 0}
                  className="btn-neon flex-1 py-3 rounded-xl disabled:opacity-40"
                >
                  Finish Setup →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Complete ── */}
          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1, times: [0, 0.3, 0.6, 1] }}
                className="text-6xl mb-6"
              >
                🎉
              </motion.div>
              <h2 className="font-display font-bold text-3xl text-white mb-4">
                You're all set, {name || "Student"}!
              </h2>
              <p className="text-white/60 mb-2">
                ApniAwaaz is now personalized for you.
              </p>
              <p className="text-white/40 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                Start practicing, ask the AI coach anything in your language, and build your English confidence every day!
              </p>

              <div className="glass-card p-4 mb-6 text-left space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Your profile</p>
                <p className="text-sm text-white/70">📚 {EDUCATION_LEVELS.find((l: { id: string; label: string }) => l.id === educationLevel)?.label}</p>
                <p className="text-sm text-white/70">🗣️ {LANGUAGES.find((l: Language) => l.code === preferredLanguage)?.name ?? "Hindi"}</p>
                <p className="text-sm text-white/70">🎯 {selectedGoals.length} goals selected</p>
              </div>

              <button
                id="finish-onboarding-btn"
                onClick={finish}
                className="btn-neon w-full py-4 rounded-2xl text-base"
              >
                Start My Journey! 🚀
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

