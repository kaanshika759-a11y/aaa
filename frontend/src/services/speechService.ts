/**
 * speechService.ts
 * Browser speech helpers for the ApniAwaaz frontend.
 *
 * Key features:
 *  - Mic-permission pre-check via getUserMedia before starting recognition.
 *  - Automatic retry on transient network errors (up to MAX_NETWORK_RETRIES).
 *  - Auto-restart on unexpected onend while still in listening mode.
 *  - Graceful, user-friendly messages for every SpeechRecognition error code.
 *  - Continuous + interim results mode for responsive live transcription.
 *  - All recognition state is encapsulated; callers receive a SpeechSession
 *    handle with a .stop() method for clean teardown.
 *  - Legacy backwards-compatible wrapper preserved for old call sites.
 */

// ─── Locale map ───────────────────────────────────────────────────────────────

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  auto: "en-US",
  en: "en-US",
  "en-us": "en-US",
  "en-in": "en-IN",
  "en-gb": "en-GB",
  hi: "hi-IN",
  "hi-in": "hi-IN",
  bn: "bn-IN",
  "bn-in": "bn-IN",
  ta: "ta-IN",
  "ta-in": "ta-IN",
  te: "te-IN",
  "te-in": "te-IN",
  mr: "mr-IN",
  "mr-in": "mr-IN",
  gu: "gu-IN",
  "gu-in": "gu-IN",
  kn: "kn-IN",
  "kn-in": "kn-IN",
  ml: "ml-IN",
  "ml-in": "ml-IN",
  pa: "pa-IN",
  "pa-in": "pa-IN",
  or: "or-IN",
  "or-in": "or-IN",
  as: "as-IN",
  "as-in": "as-IN",
  ur: "ur-IN",
  "ur-in": "ur-IN",
  sa: "sa-IN",
  "sa-in": "sa-IN",
  ne: "ne-NP",
  "ne-np": "ne-NP",
  ks: "ks-IN",
  "ks-in": "ks-IN",
  sd: "sd-IN",
  "sd-in": "sd-IN",
  doi: "doi-IN",
  "doi-in": "doi-IN",
  kok: "kok-IN",
  "kok-in": "kok-IN",
  mai: "mai-IN",
  "mai-in": "mai-IN",
  mni: "mni-IN",
  "mni-in": "mni-IN",
  brx: "brx-IN",
  "brx-in": "brx-IN",
  sat: "sat-IN",
  "sat-in": "sat-IN",
};

/** Converts an ISO code or locale string into the canonical BCP-47 locale Web Speech API expects. */
export const getSpeechLocale = (language: string): string =>
  LOCALE_BY_LANGUAGE[language?.trim().toLowerCase()] ?? language ?? "en-US";

// ─── Error message mapping ────────────────────────────────────────────────────

const recognitionErrorMessage = (code?: string): string => {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied. Allow microphone access and try again.";
    case "no-speech":
      return "No speech detected. Please speak a little closer to the microphone and try again.";
    case "network":
      return "Speech recognition needs an internet connection. Check your connection, then try again or type your text instead.";
    case "audio-capture":
      return "No microphone was found. Connect a microphone or type your text instead.";
    case "language-not-supported":
      return "This browser does not support speech recognition for the selected language. You can still type your text.";
    case "aborted":
      return ""; // Intentional abort - suppress UI noise.
    default:
      return "Speech recognition could not start. Please try again or type your text instead.";
  }
};

// ─── Mic permission pre-check ─────────────────────────────────────────────────

/**
 * Requests microphone access via getUserMedia as a pre-flight check.
 * Returns true if granted, false (after calling onError) if denied or unavailable.
 */
const checkMicPermission = async (onError: (msg: string) => void): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return true; // proceed; let SpeechRecognition surface its own error.
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // Release immediately.
    return true;
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      onError("Microphone permission was denied. Allow microphone access in your browser settings and try again.");
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      onError("No microphone was found. Connect a microphone or type your text instead.");
    } else {
      onError("Could not access the microphone. Please check your device settings and try again.");
    }
    return false;
  }
};

// ─── Session handle ───────────────────────────────────────────────────────────

export interface SpeechSession {
  /** Stops listening immediately and cleans up all internal state. */
  stop: () => void;
  /** True while this session is active (not yet stopped). */
  readonly active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of automatic retries on a network error before giving up. */
const MAX_NETWORK_RETRIES = 4;
/** Base pause between automatic network-error retries in ms. */
const BASE_RETRY_DELAY_MS = 600;
/** Pause before auto-restarting after an unexpected onend in continuous mode in ms. */
const RESTART_DELAY_MS = 250;

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ListenSpeechOptions {
  /** BCP-47 language tag or ISO code. */
  language: string;
  /**
   * Called with each recognised transcript fragment.
   * isFinal is true once the engine has committed the result.
   */
  onResult: (text: string, isFinal: boolean) => void;
  /** Called when an unrecoverable error occurs. The session is stopped before calling. */
  onError: (message: string) => void;
  /** Called when the session ends (manually stopped or fatal error). */
  onEnd?: () => void;
  /**
   * If true, recognition runs continuously and auto-restarts on onend
   * while the session is still active. Default: false (one-shot).
   */
  continuous?: boolean;
}

// ─── Core async API ───────────────────────────────────────────────────────────

/**
 * Starts speech recognition with robust error handling and optional continuous mode.
 *
 * Returns a SpeechSession handle with a .stop() method, or null if the browser
 * does not support Web Speech API.
 */
export const listenSpeech = async (
  options: ListenSpeechOptions
): Promise<SpeechSession | null> => {
  const { language, onResult, onError, onEnd, continuous = false } = options;

  if (typeof window === "undefined") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Recognition: (new () => SpeechRecognition) | undefined =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  if (!Recognition) {
    onError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
    return null;
  }

  // Pre-flight mic permission check
  const permitted = await checkMicPermission(onError);
  if (!permitted) {
    onEnd?.();
    return null;
  }

  // Internal mutable state
  let isActive = true;
  let networkRetries = 0;
  let recognition: SpeechRecognition | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Session handle exposed to the caller
  const session: SpeechSession = {
    get active() { return isActive; },
    stop() {
      if (!isActive) return;
      isActive = false;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.stop();
        } catch {
          try { recognition.abort(); } catch { /* ignore */ }
        }
        recognition = null;
      }
      onEnd?.();
    },
  };

  // Recognition factory - called on start and each auto-restart
  function startRecognition() {
    if (!isActive) return;

    // Clean up any stale recognition reference
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* ignore */ }
      recognition = null;
    }

    try {
      recognition = new Recognition!();
    } catch (instantiationErr) {
      console.error("[Speech] Failed to instantiate SpeechRecognition:", instantiationErr);
      session.stop();
      return;
    }

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = getSpeechLocale(language);

    recognition.onresult = (event) => {
      networkRetries = 0; // Successful speech resets the network-error counter

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript ?? "";
        if (item.isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + text;
        } else {
          interimTranscript += (interimTranscript ? " " : "") + text;
        }
      }

      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript.trim()) {
        onResult(interimTranscript.trim(), false);
      }
    };

    recognition.onerror = (event) => {
      const code = event.error as string;

      if (code === "network" || code === "aborted") {
        // Transient network hiccup or abort - retry automatically with backoff
        if (networkRetries < MAX_NETWORK_RETRIES && isActive) {
          networkRetries++;
          console.warn(
            `[Speech] Connection issue (${code}) - scheduling silent retry (${networkRetries}/${MAX_NETWORK_RETRIES})...`
          );
          // onend will fire next and trigger the backoff restart
          return;
        }
        // Max retries reached - silently stop without showing disruptive error banners
        console.warn("[Speech] Network retries limit reached. Gracefully resetting speech session to idle.");
        session.stop();
        return;
      }

      if (code === "no-speech") {
        if (continuous && isActive) {
          return; // In continuous mode: silent restart, no UI noise
        }
        session.stop();
        return;
      }

      // Hard fatal errors (permissions, missing microphone, unsupported language)
      const message = recognitionErrorMessage(code);
      session.stop();
      if (message) {
        onError(message);
      }
    };

    recognition.onend = () => {
      if (!isActive) return; // We stopped intentionally

      if (continuous || networkRetries > 0) {
        // Calculate exponential backoff delay for retries
        const delay = networkRetries > 0
          ? Math.min(BASE_RETRY_DELAY_MS * Math.pow(1.5, networkRetries), 2500)
          : RESTART_DELAY_MS;

        if (retryTimer !== null) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (isActive) {
            startRecognition();
          }
        }, delay);
        return;
      }

      // One-shot mode ended naturally
      isActive = false;
      onEnd?.();
    };

    try {
      recognition.start();
    } catch (err: unknown) {
      console.warn("[Speech] recognition.start() exception:", err);
      if (
        err instanceof DOMException &&
        (err.name === "InvalidStateError" || err.name === "AbortError")
      ) {
        // Already running or pending state transition - retry cleanly after pause
        if (retryTimer !== null) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (isActive) startRecognition();
        }, RESTART_DELAY_MS);
      } else {
        session.stop();
      }
    }
  }

  startRecognition();
  return session;
};

// ─── Legacy one-shot wrapper (backwards-compatible) ───────────────────────────

/**
 * @deprecated Use the async listenSpeech(options) form instead.
 *
 * Matches the old 4-argument signature so existing call-sites (Translator
 * component, coach page inline usage) continue to work without modification.
 */
export const listenSpeechLegacy = (
  language: string,
  onResult: (text: string) => void,
  onError: (message: string) => void,
  onEnd?: () => void
): { stop: () => void } => {
  let session: SpeechSession | null = null;

  listenSpeech({
    language,
    onResult: (text, isFinal) => { if (isFinal) onResult(text); },
    onError,
    onEnd,
    continuous: false,
  }).then((s) => { session = s; });

  return { stop: () => session?.stop() };
};

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

export type SpeechPlaybackResult =
  | { ok: true;  usedFallbackVoice: boolean; message?: string }
  | { ok: false; usedFallbackVoice: false;   message: string };

const isPreferredVoice = (voice: SpeechSynthesisVoice) =>
  /google|natural|enhanced|neural|microsoft/i.test(voice.name);

const waitForVoices = (): Promise<SpeechSynthesisVoice[]> => {
  const synthesis = window.speechSynthesis;
  const available = synthesis.getVoices();
  if (available.length) return Promise.resolve(available);
  return new Promise((resolve) => {
    const finish = () => {
      synthesis.removeEventListener("voiceschanged", finish);
      resolve(synthesis.getVoices());
    };
    synthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 350);
  });
};

/** Plays text and reports an accessible fallback notice if the native language voice is absent. */
export const speakText = async (text: string, language = "en-IN"): Promise<SpeechPlaybackResult> => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { ok: false, usedFallbackVoice: false, message: "Text-to-speech is not supported in this browser." };
  }
  if (!text.trim()) {
    return { ok: false, usedFallbackVoice: false, message: "There is no text to play." };
  }

  const locale      = getSpeechLocale(language);
  const baseLang    = locale.split("-")[0].toLowerCase();
  const voices      = await waitForVoices();
  const exactVoices = voices.filter((v) => v.lang.toLowerCase() === locale.toLowerCase());
  const langVoices  = voices.filter((v) => v.lang.toLowerCase().split("-")[0] === baseLang);
  const nativeVoice = exactVoices.find(isPreferredVoice) ?? exactVoices[0] ?? langVoices.find(isPreferredVoice) ?? langVoices[0];
  const fallback    = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  const voice       = nativeVoice ?? fallback ?? voices[0];

  if (!voice) {
    return { ok: false, usedFallbackVoice: false, message: "No text-to-speech voices are available. Install a voice in device settings and try again." };
  }

  const usingFallback = !nativeVoice;
  const utterance     = new SpeechSynthesisUtterance(text.trim());
  utterance.lang  = nativeVoice ? locale : voice.lang;
  utterance.voice = voice;
  utterance.rate  = 0.92;
  utterance.pitch = 1;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: SpeechPlaybackResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    utterance.onstart = () =>
      finish({
        ok: true,
        usedFallbackVoice: usingFallback,
        message: usingFallback
          ? "A " + locale + " voice is not installed - using " + voice.lang + " instead."
          : undefined,
      });

    utterance.onerror = (event) =>
      finish({
        ok: false,
        usedFallbackVoice: false,
        message:
          event.error === "not-allowed"
            ? "Audio playback was blocked by the browser. Tap Listen again to allow it."
            : "Audio playback could not start. Check that sound is enabled and try again.",
      });

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);

    // Safety timeout: resolve OK if onstart never fires (some browsers skip it)
    window.setTimeout(
      () =>
        finish({
          ok: true,
          usedFallbackVoice: usingFallback,
          message: usingFallback
            ? "A " + locale + " voice is not installed - using " + voice.lang + " instead."
            : undefined,
        }),
      500
    );
  });
};

export const stopSpeech = (): void => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Text-to-Speech playback helper for AI responses with automatic voice matching.
 * Matches requested language code (e.g., 'hi-IN', 'ta-IN', 'en-US') with available browser voices.
 */
export const speakResponse = (
  text: string,
  langCode = "en-US",
  onEnd?: () => void
): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  if (!text || !text.trim()) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel(); // Stop ongoing speech

  const locale = getSpeechLocale(langCode);
  const baseLang = locale.split("-")[0].toLowerCase();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = locale;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const exactVoice = voices.find(
      (v) =>
        v.lang.toLowerCase() === locale.toLowerCase() ||
        v.lang.toLowerCase().replace("_", "-") === locale.toLowerCase()
    );
    const langVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(baseLang)
    );
    const preferredVoice = voices.find(
      (v) =>
        /google|natural|enhanced|neural|microsoft/i.test(v.name) &&
        v.lang.toLowerCase().startsWith(baseLang)
    );
    const selectedVoice = preferredVoice ?? exactVoice ?? langVoice;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };

  utterance.onend = finish;
  utterance.onerror = (e) => {
    console.warn("[TTS] Utterance error:", e);
    finish();
  };

  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
};
