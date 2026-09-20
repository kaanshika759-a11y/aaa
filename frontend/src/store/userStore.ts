/**
 * store/userStore.ts
 * Simple localStorage-based user preferences and progress tracking
 */

export interface UserPreferences {
  educationLevel: string;
  preferredLanguage: string;
  learningGoals: string[];
  onboardingComplete: boolean;
  name: string;
}

export interface SessionRecord {
  date: string;
  type: "voice" | "text" | "practice" | "camera" | "daily";
  durationSeconds: number;
  wordsSpoken: number;
  messagesCount: number;
}

export interface Progress {
  totalSessions: number;
  totalSpeakingSeconds: number;
  completedChallenges: number;
  vocabularyLearned: number;
  conversationSessions: number;
  translationCount: number;
  lastActiveDate: string;
  sessions: SessionRecord[];
  streak: number;
}

const PREFS_KEY = "apni_awaaz_prefs";
const PROGRESS_KEY = "apni_awaaz_progress";

const DEFAULT_PREFS: UserPreferences = {
  educationLevel: "",
  preferredLanguage: "hi",
  learningGoals: [],
  onboardingComplete: false,
  name: "",
};

const DEFAULT_PROGRESS: Progress = {
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

// ─── Preferences ──────────────────────────────────────────────────────────────

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  const current = getPreferences();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function getProgress(): Progress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    return stored ? { ...DEFAULT_PROGRESS, ...JSON.parse(stored) } : DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: Partial<Progress>): void {
  if (typeof window === "undefined") return;
  const current = getProgress();
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...current, ...progress }));
}

export function recordSession(session: SessionRecord): void {
  if (typeof window === "undefined") return;
  const progress = getProgress();
  const today = new Date().toDateString();

  // Update streak
  const lastDate = progress.lastActiveDate;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newStreak =
    lastDate === yesterday ? progress.streak + 1 : lastDate === today ? progress.streak : 1;

  const updated: Progress = {
    ...progress,
    totalSessions: progress.totalSessions + 1,
    totalSpeakingSeconds: progress.totalSpeakingSeconds + session.durationSeconds,
    conversationSessions: progress.conversationSessions + (session.type === "voice" || session.type === "text" ? 1 : 0),
    completedChallenges: progress.completedChallenges + (session.type === "daily" ? 1 : 0),
    lastActiveDate: today,
    streak: newStreak,
    sessions: [session, ...progress.sessions].slice(0, 50), // keep last 50
  };

  localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
}

export function recordTranslation(): void {
  if (typeof window === "undefined") return;
  const progress = getProgress();
  saveProgress({ translationCount: progress.translationCount + 1 });
}

export function recordVocabularyLearned(count: number = 1): void {
  if (typeof window === "undefined") return;
  const progress = getProgress();
  saveProgress({ vocabularyLearned: progress.vocabularyLearned + count });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}
