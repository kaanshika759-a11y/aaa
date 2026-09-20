"use client";

/**
 * Vocabulary Builder & Word Explorer
 * Tailored for Indian English learners with audio pronunciation,
 * Indian context nuances, and flashcard practice.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { lookupVocabulary, VocabularyResult, speakText } from "@/services/api";
import { recordVocabularyLearned } from "@/store/userStore";

interface CuratedWord {
  word: string;
  pronunciation: string;
  category: "interview" | "corporate" | "daily" | "common-errors";
  meaning: string;
  indianContext: string;
  examples: string[];
  synonyms: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

const CURATED_WORDS: CuratedWord[] = [
  {
    word: "Articulate",
    pronunciation: "ahr-TIK-yuh-lit",
    category: "interview",
    meaning: "Able to express ideas clearly and effectively in speech or writing.",
    indianContext: "Frequently praised in Indian tech and HR interviews. Instead of saying 'He speaks good English', say 'He is very articulate'.",
    examples: [
      "She gave an articulate presentation to the board of directors.",
      "An articulate engineer can explain technical concepts to non-technical stakeholders.",
    ],
    synonyms: ["Eloquent", "Expressive", "Coherent", "Clear"],
    difficulty: "intermediate",
  },
  {
    word: "Proactive",
    pronunciation: "proh-AK-tiv",
    category: "corporate",
    meaning: "Taking action by causing change and taking initiative rather than reacting after something happens.",
    indianContext: "Highly valued in appraisal reviews. Indian managers love candidates who show proactive ownership rather than waiting for instructions.",
    examples: [
      "Instead of waiting for a bug report, he took a proactive approach to testing.",
      "Be proactive in asking questions during your college internship.",
    ],
    synonyms: ["Enterprising", "Resourceful", "Driven", "Forward-thinking"],
    difficulty: "intermediate",
  },
  {
    word: "Do the needful",
    pronunciation: "doo thuh NEED-fuhl (Indianism)",
    category: "common-errors",
    meaning: "An archaic British colonial phrase meaning 'do what is necessary'.",
    indianContext: "Very commonly used in Indian emails, but sounds outdated to international clients. Better alternatives: 'Please look into this', 'Kindly take the necessary action', or 'Please handle this'.",
    examples: [
      "Modern style: 'Could you please review the attached document and take the next steps?'",
      "Avoid: 'Please find attachment and do the needful.'",
    ],
    synonyms: ["Take action", "Handle the matter", "Address the issue"],
    difficulty: "beginner",
  },
  {
    word: "Revert",
    pronunciation: "ri-VURT",
    category: "common-errors",
    meaning: "To return to a previous state or condition. (NOT 'to reply'!)",
    indianContext: "In Indian corporate parlance, people say 'I will revert back to you'. In standard English, 'revert' means to regress. Say 'I will get back to you' or 'I will reply shortly'.",
    examples: [
      "Standard: 'I will reply to your email by tomorrow afternoon.'",
      "Correct usage of revert: 'The system reverted to its default configuration.'",
    ],
    synonyms: ["Reply", "Get back to", "Respond"],
    difficulty: "beginner",
  },
  {
    word: "Prepone",
    pronunciation: "pree-POHN",
    category: "common-errors",
    meaning: "An Indian English coinage meaning to advance a date or time (opposite of postpone).",
    indianContext: "While recognized in Indian English dictionaries, global colleagues usually say 'bring forward', 'move up', or 'reschedule earlier'.",
    examples: [
      "Global English: 'We need to bring forward tomorrow's meeting to 10:00 AM.'",
      "Indian English: 'The exam was preponed by two days.'",
    ],
    synonyms: ["Bring forward", "Advance", "Reschedule earlier"],
    difficulty: "beginner",
  },
  {
    word: "Diligence",
    pronunciation: "DIL-i-juhns",
    category: "interview",
    meaning: "Persistent and careful work or effort.",
    indianContext: "A top character trait highlighted in resumes and recommendation letters.",
    examples: [
      "His diligence in verifying data prevented a major deployment failure.",
      "Academic diligence is the cornerstone of passing competitive examinations.",
    ],
    synonyms: ["Thoroughness", "Meticulousness", "Perseverance", "Dedication"],
    difficulty: "advanced",
  },
  {
    word: "Concise",
    pronunciation: "kuhn-SYS",
    category: "corporate",
    meaning: "Giving a lot of information clearly and in a few words; brief but comprehensive.",
    indianContext: "Crucial for emails and presentations where Indian students often tend to write very long, elaborate paragraphs.",
    examples: [
      "Keep your self-introduction concise — aim for under 90 seconds.",
      "His email was short, concise, and straight to the point.",
    ],
    synonyms: ["Succinct", "Brevity", "Crisp", "To the point"],
    difficulty: "intermediate",
  },
  {
    word: "Empathetic",
    pronunciation: "em-puh-THET-ik",
    category: "daily",
    meaning: "Showing an ability to understand and share the feelings of another.",
    indianContext: "Essential for leadership and team management roles.",
    examples: [
      "An empathetic listener makes team members feel valued and heard.",
      "She responded to the student's personal problem with empathetic guidance.",
    ],
    synonyms: ["Compassionate", "Understanding", "Sensitive", "Considerate"],
    difficulty: "intermediate",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Words", icon: "✨" },
  { id: "common-errors", label: "Common Indian Errors", icon: "⚠️" },
  { id: "interview", label: "Interview Winners", icon: "💼" },
  { id: "corporate", label: "Corporate & Email", icon: "🏢" },
  { id: "daily", label: "Everyday Fluency", icon: "🗣️" },
];

export default function VocabularyPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchedWord, setSearchedWord] = useState<VocabularyResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"cards" | "flashcards">("cards");
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Play audio pronunciation via Web Speech API or backend TTS
  const playAudio = async (text: string) => {
    setPlayingWord(text);
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        utterance.onend = () => setPlayingWord(null);
        utterance.onerror = () => setPlayingWord(null);
        window.speechSynthesis.speak(utterance);
      } else {
        await speakText(text);
        setPlayingWord(null);
      }
    } catch {
      setPlayingWord(null);
    }
  };

  // Live lookup from backend API
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchedWord(null);

    try {
      const result = await lookupVocabulary(searchTerm.trim());
      setSearchedWord(result);
    } catch {
      // Fallback local lookup if server offline
      const localMatch = CURATED_WORDS.find(
        (w) => w.word.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      if (localMatch) {
        setSearchedWord({
          success: true,
          word: localMatch.word,
          meaning: localMatch.meaning,
          pronunciation: localMatch.pronunciation,
          examples: localMatch.examples,
          synonyms: localMatch.synonyms,
          indianContext: localMatch.indianContext,
          difficulty: localMatch.difficulty,
        });
      } else {
        setSearchError(
          `Could not find an online explanation for "${searchTerm}". Showing related words below.`
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const handleMarkLearned = (word: string) => {
    setLearnedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
        recordVocabularyLearned(1);
      }
      return next;
    });
  };

  // Filter curated words
  const filteredWords = CURATED_WORDS.filter((w) => {
    const matchesCategory =
      activeCategory === "all" || w.category === activeCategory;
    const matchesSearch =
      searchTerm === "" ||
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.meaning.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-full w-full py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">📚</span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Vocabulary & Nuance Explorer
            </h1>
          </div>
          <p className="text-white/50 text-sm mt-1">
            Master high-impact English words, unlearn outdated colonial phrases, and speak with authentic flair.
          </p>
        </div>

        {/* View Switcher & Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.04] border border-white/[0.08] px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs text-white/70">
            <span className="text-emerald-400 font-bold">{learnedWords.size}</span>
            <span>Mastered Today</span>
          </div>

          <div className="flex bg-white/[0.05] border border-white/[0.08] p-1 rounded-xl">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "cards"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("flashcards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "flashcards"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Flashcards
            </button>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <form onSubmit={handleSearch} className="relative max-w-2xl">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Look up any English word (e.g., Diligence, Synergize, Revert)..."
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 pl-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg">
          🔍
        </span>
        <button
          type="submit"
          disabled={searching || !searchTerm.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 text-white font-medium text-xs rounded-xl transition-all shadow-md"
        >
          {searching ? "Searching AI..." : "Explore Word"}
        </button>
      </form>

      {/* ── Live AI Word Result (if searched) ── */}
      <AnimatePresence>
        {searchedWord && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-6 border-blue-500/30 bg-blue-500/[0.03] relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white tracking-wide">
                    {searchedWord.word}
                  </h2>
                  <span className="text-sm font-mono text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    /{searchedWord.pronunciation}/
                  </span>
                  <button
                    onClick={() => playAudio(searchedWord.word)}
                    disabled={playingWord === searchedWord.word}
                    className="w-8 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 flex items-center justify-center text-sm transition-all"
                    title="Listen to pronunciation"
                  >
                    {playingWord === searchedWord.word ? "🔊" : "🔈"}
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-2">{searchedWord.meaning}</p>
              </div>

              <button
                onClick={() => handleMarkLearned(searchedWord.word)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                  learnedWords.has(searchedWord.word)
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-white/05 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {learnedWords.has(searchedWord.word) ? "✓ Mastered" : "+ Mark as Mastered"}
              </button>
            </div>

            {searchedWord.indianContext && (
              <div className="mt-4 p-3.5 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
                <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                  <span>💡</span> Indian Context & Usage Nuance
                </p>
                <p className="text-xs text-white/80 leading-relaxed">
                  {searchedWord.indianContext}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">
                  Real-world Examples
                </p>
                <ul className="space-y-1.5">
                  {searchedWord.examples.map((ex, i) => (
                    <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">
                  Synonyms & Alternatives
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {searchedWord.synonyms.map((syn, i) => (
                    <span
                      key={i}
                      className="text-xs bg-white/05 border border-white/10 px-2.5 py-1 rounded-lg text-white/80"
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {searchError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
          {searchError}
        </div>
      )}

      {/* ── Category Filter Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
              activeCategory === cat.id
                ? "bg-white text-black font-semibold shadow-md"
                : "bg-white/05 border border-white/08 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main View: Flashcards or Card Grid ── */}
      {viewMode === "flashcards" ? (
        <div className="max-w-xl mx-auto py-6">
          {filteredWords.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              No words match the selected category.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-xs text-white/50 px-2">
                <span>Card {flashcardIndex + 1} of {filteredWords.length}</span>
                <span>Click card to flip</span>
              </div>

              {/* Flip Card */}
              <div
                onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                className="cursor-pointer min-h-[320px] rounded-3xl p-8 glass-card border border-white/10 flex flex-col justify-between relative transition-all duration-300 hover:border-blue-500/40 shadow-xl"
              >
                {!flashcardFlipped ? (
                  /* Front of Card */
                  <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4">
                    <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold">
                      {filteredWords[flashcardIndex].category.replace("-", " ")}
                    </span>
                    <h3 className="text-4xl font-display font-bold text-white tracking-tight">
                      {filteredWords[flashcardIndex].word}
                    </h3>
                    <p className="text-sm font-mono text-white/50">
                      /{filteredWords[flashcardIndex].pronunciation}/
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(filteredWords[flashcardIndex].word);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white/80 flex items-center gap-1.5"
                    >
                      <span>🔊</span> Listen
                    </button>
                    <p className="text-xs text-white/30 pt-6">Tap to reveal meaning & Indian nuance</p>
                  </div>
                ) : (
                  /* Back of Card */
                  <div className="flex flex-col justify-between flex-1 space-y-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                        Meaning
                      </span>
                      <p className="text-base text-white/90 mt-1">
                        {filteredWords[flashcardIndex].meaning}
                      </p>
                    </div>

                    <div className="p-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
                      <p className="text-xs font-semibold text-amber-400 mb-1">
                        💡 Indian Context
                      </p>
                      <p className="text-xs text-white/70">
                        {filteredWords[flashcardIndex].indianContext}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">
                        Example
                      </span>
                      <p className="text-xs text-white/80 italic mt-0.5">
                        "{filteredWords[flashcardIndex].examples[0]}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setFlashcardFlipped(false);
                    setFlashcardIndex((prev) => (prev > 0 ? prev - 1 : filteredWords.length - 1));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/05 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all"
                >
                  ← Previous
                </button>

                <button
                  onClick={() => handleMarkLearned(filteredWords[flashcardIndex].word)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    learnedWords.has(filteredWords[flashcardIndex].word)
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-white/05 border-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {learnedWords.has(filteredWords[flashcardIndex].word) ? "✓ Mastered" : "+ Mark Mastered"}
                </button>

                <button
                  onClick={() => {
                    setFlashcardFlipped(false);
                    setFlashcardIndex((prev) => (prev < filteredWords.length - 1 ? prev + 1 : 0));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid of Curated Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWords.map((w) => {
            const isMastered = learnedWords.has(w.word);
            return (
              <motion.div
                key={w.word}
                layout
                className={`glass-card p-6 rounded-2xl flex flex-col justify-between border transition-all ${
                  isMastered
                    ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                    : "border-white/[0.07] hover:border-white/20"
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white tracking-wide">
                          {w.word}
                        </h3>
                        <button
                          onClick={() => playAudio(w.word)}
                          disabled={playingWord === w.word}
                          className="text-white/40 hover:text-white text-sm transition-colors"
                          title="Listen to pronunciation"
                        >
                          {playingWord === w.word ? "🔊" : "🔈"}
                        </button>
                      </div>
                      <span className="text-xs font-mono text-white/40">
                        /{w.pronunciation}/
                      </span>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                        w.category === "common-errors"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : w.category === "interview"
                          ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                          : "bg-violet-500/10 text-violet-300 border-violet-500/30"
                      }`}
                    >
                      {w.category.replace("-", " ")}
                    </span>
                  </div>

                  {/* Meaning */}
                  <p className="text-xs text-white/80 leading-relaxed">{w.meaning}</p>

                  {/* Indian Context Highlight */}
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-1">
                    <p className="font-semibold text-white/60 flex items-center gap-1">
                      <span>🇮🇳</span> Usage Note:
                    </p>
                    <p className="text-white/70 text-[11px] leading-relaxed">
                      {w.indianContext}
                    </p>
                  </div>

                  {/* Example */}
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">
                      Example:
                    </p>
                    <p className="text-xs text-white/70 italic bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                      "{w.examples[0]}"
                    </p>
                  </div>

                  {/* Synonyms */}
                  <div className="flex flex-wrap gap-1">
                    {w.synonyms.map((syn) => (
                      <span
                        key={syn}
                        className="text-[10px] bg-white/[0.04] text-white/60 px-2 py-0.5 rounded-md"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-5 border-t border-white/[0.06] mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-white/40 capitalize">
                    {w.difficulty} Level
                  </span>
                  <button
                    onClick={() => handleMarkLearned(w.word)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      isMastered
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-white/05 text-white/70 border-white/10 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {isMastered ? "✓ Mastered" : "+ Mark Mastered"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
