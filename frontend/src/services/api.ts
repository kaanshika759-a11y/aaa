/**
 * services/api.ts
 * Typed REST API wrappers for the ApniAwaaz backend
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  "http://localhost:4000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  reply: string;
  translatedText: string;
  success?: boolean;
  status?: string;
  fromLanguage?: string;
  toLanguage?: string;
  fromLang?: string;
  toLang?: string;
  detectedLanguage?: string;
  // Standard & extended fields
  naturalEnglish?: string;
  professionalEnglish?: string;
  // When translating to English
  literal?: string;
  natural?: string;
  confident?: string;
  // When translating to other languages
  translation?: string;
  note?: string;
  error?: string;
}

export interface PracticeFeedback {
  success: boolean;
  feedback: string;
  error?: string;
}

export interface VocabularyResult {
  success: boolean;
  word: string;
  meaning: string;
  pronunciation: string;
  examples: string[];
  synonyms: string[];
  indianContext: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  error?: string;
}

export interface DailyChallenge {
  title: string;
  prompt: string;
  duration: number;
  tips: string[];
  category: string;
}

// ─── Translate ────────────────────────────────────────────────────────────────

export async function translateText(
  text: string,
  fromLanguage: string = "auto",
  toLanguage: string = "English"
): Promise<TranslationResult> {
  const payload = {
    text,
    fromLang: fromLanguage,
    toLang: toLanguage,
    fromLanguage,
    toLanguage,
  };

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Retry with BASE_URL if relative fetch encounters network proxy edge case
  }

  const res = await fetch(`${BASE_URL}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Translation request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}


// ─── Practice Feedback ────────────────────────────────────────────────────────

export async function getPracticeFeedback(
  transcript: string,
  mode: string = "general",
  topic: string = ""
): Promise<PracticeFeedback> {
  const res = await fetch(`${BASE_URL}/api/practice/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, mode, topic }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export async function lookupVocabulary(
  word: string,
  context: string = ""
): Promise<VocabularyResult> {
  const res = await fetch(`${BASE_URL}/api/vocabulary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Daily Challenge ──────────────────────────────────────────────────────────

export async function getDailyChallenge(): Promise<{
  success: boolean;
  challenge: DailyChallenge;
  date: string;
}> {
  const res = await fetch(`${BASE_URL}/api/daily-challenge`);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Stream TTS Audio ─────────────────────────────────────────────────────────

export async function speakText(text: string): Promise<AudioBuffer> {
  const res = await fetch(`${BASE_URL}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`TTS HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audioCtx = new AudioContext();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

// ─── Stream Chat (SSE) ────────────────────────────────────────────────────────

export async function streamChat(
  message: string,
  history: { role: string; content: string }[],
  onToken: (token: string) => void,
  onDone: (reply: string) => void,
  onError: (err: string) => void
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "Unknown error");
    onError(errText);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) {
          onError(data.error);
          return;
        }
        if (data.token) {
          onToken(data.token);
        }
        if (data.done) {
          onDone(data.reply);
          return;
        }
      } catch {
        // Skip malformed lines
      }
    }
  }
}
