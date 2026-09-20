/**
 * ============================================================
 *  ApniAwaaz – AI Multilingual Communication & Confidence Coach
 *  Backend: Express + Socket.io
 * ============================================================
 *
 *  Pipeline per session:
 *    Mic (browser) → WebSocket → STT → LLM → TTS → WebSocket → Speaker (browser)
 *
 *  Also exposes REST endpoints:
 *    POST /api/chat      – text-based AI chat
 *    POST /api/translate – multilingual translation
 *    POST /api/speak     – TTS for given text (returns audio stream)
 *
 *  ENV variables (backend/.env):
 *    PORT=4000
 *    DEEPGRAM_API_KEY=...
 *    GEMINI_API_KEY=...
 *    ELEVENLABS_API_KEY=... (optional)
 *    ELEVENLABS_VOICE_ID=... (optional)
 *    CLIENT_ORIGIN=http://localhost:3000
 */

import 'dotenv/config';
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createLiveSession } from "./src/pipeline/stt.js";
import { runTTS, USE_CLIENT_TTS } from "./src/pipeline/tts.js";
import {
  streamGeminiResponse,
  generateGeminiContent,
  sanitizeGeminiHistory,
  isRateLimitOrQuotaError,
  extractRetryDelay,
  formatRateLimitMessage,
  RATE_LIMIT_MESSAGE,
} from "./src/pipeline/llm.js";
import path from "path";
import { fileURLToPath } from "url";

// Disable TLS certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Ensure .env is loaded from backend directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("[Server] Backend directory:", __dirname);
console.log("[Server] GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);

// ─── Express & HTTP Server ────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (process.env.CLIENT_ORIGIN && origin === process.env.CLIENT_ORIGIN) return true;
  return true; // allow all in dev environment
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "4mb" }));

// Health-check endpoint
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
  maxHttpBufferSize: 1e7, // 10 MB – needed for audio chunks
});

// ─── API clients ──────────────────────────────────────────────────────────────

// Initialize Gemini client with fallbacks
let geminiClient = null;

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found. Please set one of: GEMINI_API_KEY, GOOGLE_API_KEY, or NEXT_PUBLIC_GEMINI_API_KEY in .env");
  } else {
    console.log("[Gemini] API key loaded, prefix:", apiKey.substring(0, 10));
  }
  return apiKey;
}

function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please add GEMINI_API_KEY to backend/.env");
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

function getGeminiModel(customConfig = {}) {
  const client = getGeminiClient();
  const generationConfig = {
    maxOutputTokens: 2048,
    temperature: 0.7,
    ...customConfig,
  };
  return client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    generationConfig,
  });
}

// ─── Gemini Role Sanitizer (Layer 1 – Imported from ./src/pipeline/llm.js) ───
// Central utility function sanitizeGeminiHistory is imported above from llm.js.


// Intercept getGeminiModel to auto-patch startChat with sanitizer as a
// last-resort fail-safe (Layer 2 – SDK interception).
function getSafeGeminiModel() {
  const model = getGeminiModel();
  const originalStartChat = model.startChat.bind(model);
  model.startChat = function (options = {}) {
    if (options && Array.isArray(options.history)) {
      options.history = sanitizeGeminiHistory(options.history);
    }
    return originalStartChat(options);
  };
  return model;
}

// ─── System prompts ───────────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  "en": "English",
  "en-us": "English",
  "en-in": "English",
  "en-gb": "English",
  "hi": "Hindi",
  "hi-in": "Hindi",
  "bn": "Bengali",
  "bn-in": "Bengali",
  "te": "Telugu",
  "te-in": "Telugu",
  "mr": "Marathi",
  "mr-in": "Marathi",
  "ta": "Tamil",
  "ta-in": "Tamil",
  "ur": "Urdu",
  "ur-in": "Urdu",
  "gu": "Gujarati",
  "gu-in": "Gujarati",
  "kn": "Kannada",
  "kn-in": "Kannada",
  "ml": "Malayalam",
  "ml-in": "Malayalam",
  "pa": "Punjabi",
  "pa-in": "Punjabi",
  "or": "Odia",
  "or-in": "Odia",
  "as": "Assamese",
  "as-in": "Assamese",
  "mai": "Maithili",
  "kok": "Konkani",
  "ne": "Nepali",
  "sa": "Sanskrit",
  "sd": "Sindhi",
  "mni": "Manipuri",
  "sat": "Santali",
  "doi": "Dogri",
  "ks": "Kashmiri",
};

function getTargetLanguageName(code) {
  if (!code) return "English";
  const clean = String(code).trim().toLowerCase();
  return LANGUAGE_NAMES[clean] || LANGUAGE_NAMES[clean.split("-")[0]] || code;
}

const COACH_SYSTEM_PROMPT = `You are ApniAwaaz, a warm, supportive, and empathetic AI Multilingual Communication & Confidence Coach for Indian students.

Core Principles:
1. MULTILINGUAL UNDERSTANDING: The student may communicate with you by speaking or typing in ANY language (e.g., Hindi, English, Hinglish, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, etc.). Always understand their exact meaning and intent.
2. OUTPUT LANGUAGE ADHERENCE: You must formulate your coaching response and explanations strictly in the requested target output language.
3. CLEAR & SIMPLE COACHING:
   - Provide simple, easy-to-understand explanations.
   - If the student asks how to say something or needs communication advice, explain clearly with natural examples.
   - Keep the tone friendly, encouraging, and confidence-building.
4. CONCISE FOR SPEECH SYNTHESIS:
   - Keep responses concise (2 to 4 sentences).
   - Write in plain, conversational text without markdown bullet lists, asterisks, or symbols that sound awkward when read aloud by Text-to-Speech engines.
5. NEVER judge or make the student feel embarrassed. Celebrate their efforts to learn and communicate.`;

const TRANSLATION_SYSTEM_PROMPT = `You are a professional multilingual translator specializing in Indian languages. 
When given text, translate it accurately and naturally.
For translations TO English, also provide:
1. A simple/literal translation
2. A natural, fluent English version  
3. A confident, professional English version (when applicable)

Always respond in valid JSON format as instructed.`;

// ─── REST API: /api/chat ──────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, history = [], mode = "coach", language = "en" } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    // Streaming response via SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Build conversation history for Gemini.
    const rawMessages = [
      { role: "user", parts: [{ text: COACH_SYSTEM_PROMPT + "\n\n" }] },
      ...history.map((m) => ({
        role: m.role === "assistant" || m.role === "bot" ? "model"
             : m.role === "system" ? "user"
             : m.role,
        parts: [{ text: m.content ?? m.text ?? "" }],
      })),
    ];

    const safeHistory = sanitizeGeminiHistory(rawMessages);
    let fullReply = "";

    const streamResult = await streamGeminiResponse(
      message,
      (token) => {
        fullReply += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      safeHistory
    );

    const finalReply = streamResult.reply || fullReply;
    res.write(`data: ${JSON.stringify({ done: true, reply: finalReply })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const friendlyError = isRateLimitOrQuotaError(err)
      ? RATE_LIMIT_MESSAGE
      : err.message || "An unexpected error occurred.";

    if (!res.headersSent) {
      res.status(500).json({ error: friendlyError });
    } else {
      res.write(`data: ${JSON.stringify({ error: friendlyError })}\n\n`);
      res.end();
    }
  }
});

// ─── Language mapping helper ──────────────────────────────────────────────────
const LANGUAGE_CODE_NAME_MAP = {
  "auto": "auto",
  "en": "English", "en-in": "English", "en-us": "English", "en-gb": "English",
  "hi": "Hindi", "hi-in": "Hindi",
  "bn": "Bengali", "bn-in": "Bengali",
  "ta": "Tamil", "ta-in": "Tamil",
  "te": "Telugu", "te-in": "Telugu",
  "mr": "Marathi", "mr-in": "Marathi",
  "gu": "Gujarati", "gu-in": "Gujarati",
  "kn": "Kannada", "kn-in": "Kannada",
  "ml": "Malayalam", "ml-in": "Malayalam",
  "pa": "Punjabi", "pa-in": "Punjabi",
  "or": "Odia", "or-in": "Odia",
  "as": "Assamese", "as-in": "Assamese",
  "ur": "Urdu", "ur-in": "Urdu",
  "sa": "Sanskrit", "sa-in": "Sanskrit",
  "ne": "Nepali", "ne-np": "Nepali", "ne-in": "Nepali",
  "ks": "Kashmiri", "ks-in": "Kashmiri",
  "sd": "Sindhi", "sd-in": "Sindhi",
  "doi": "Dogri", "doi-in": "Dogri",
  "kok": "Konkani", "kok-in": "Konkani",
  "mai": "Maithili", "mai-in": "Maithili",
  "mni": "Manipuri", "mni-in": "Manipuri",
  "brx": "Bodo", "brx-in": "Bodo", "bodo": "Bodo",
  "sat": "Santali", "sat-in": "Santali"
};

function resolveLangName(lang) {
  if (!lang) return "English";
  const normalized = String(lang).trim().toLowerCase();
  return LANGUAGE_CODE_NAME_MAP[normalized] || lang;
}

// ─── REST API: /api/translate ─────────────────────────────────────────────────
app.post("/api/translate", async (req, res) => {
  const text = req.body.text ?? req.body.sourceText ?? "";
  const rawFrom = req.body.fromLang ?? req.body.fromLanguage ?? req.body.sourceLang ?? "auto";
  const rawTo = req.body.toLang ?? req.body.toLanguage ?? req.body.targetLang ?? "en-IN";

  if (!text || !text.trim()) {
    return res.status(400).json({
      error: "Please enter or speak text to translate.",
      details: "text is required"
    });
  }

  try {
    const resolvedFrom = resolveLangName(rawFrom);
    const resolvedTo = resolveLangName(rawTo);

    const isToEnglish =
      resolvedTo.toLowerCase() === "english" ||
      resolvedTo.toLowerCase() === "en" ||
      rawTo.toLowerCase().startsWith("en");

    const prompt = isToEnglish
      ? `Translate the following text from ${resolvedFrom === "auto" ? "its detected language" : resolvedFrom} to English.

Text: "${text}"

Respond ONLY in this exact JSON format:
{
  "detectedLanguage": "<detected source language>",
  "literal": "<word-for-word translation>",
  "natural": "<natural, fluent English>",
  "confident": "<confident, professional English version>",
  "note": "<optional brief tip about the phrase or expression>"
}`
      : `Translate the following text from ${resolvedFrom === "auto" ? "its detected language" : resolvedFrom} to ${resolvedTo}.

Text: "${text}"

Respond ONLY in this exact JSON format:
{
  "detectedLanguage": "<detected source language>",
  "translation": "<translation in ${resolvedTo}>",
  "note": "<optional brief contextual note>"
}`;

    let result = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await generateGeminiContent(
          [{ role: "user", parts: [{ text: prompt }] }],
          {
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            temperature: 0.3,
          }
        );

        const responseText = response.text;
        result = JSON.parse(responseText);
      } catch (aiErr) {
        console.warn("[/api/translate] Gemini call failed, using rule-based translation fallback:", aiErr.message);
      }
    }

    if (!result) {
      try {
        const fromCode = (rawFrom || "hi").split("-")[0].toLowerCase();
        const toCode = (rawTo || "en").split("-")[0].toLowerCase();
        const pair = `${fromCode || "hi"}|${toCode || "en"}`;
        const fbRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`, {
          headers: { "User-Agent": "ApniAwaaz-Translator/1.0" }
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbText = fbData?.responseData?.translatedText;
          if (fbText && typeof fbText === "string" && fbText.trim()) {
            result = {
              detectedLanguage: resolvedFrom === "auto" ? "Hindi" : resolvedFrom,
              natural: fbText.trim(),
              confident: fbText.trim(),
              literal: fbText.trim(),
              translation: fbText.trim(),
              note: "Translated via high-availability engine"
            };
          }
        }
      } catch (fbErr) {
        console.warn("[/api/translate] Fallback translation failed:", fbErr.message);
      }
    }

    const detectedLanguage = result?.detectedLanguage || (resolvedFrom === "auto" ? "Hindi" : resolvedFrom);
    const natural = result?.natural || result?.translation || text;
    const confident = result?.confident || result?.natural || text;
    const literal = result?.literal || natural;
    const translation = result?.translation || natural;
    const note = result?.note || "";

    return res.json({
      success: true,
      status: "success",
      fromLanguage: resolvedFrom,
      toLanguage: resolvedTo,
      fromLang: rawFrom,
      toLang: rawTo,
      detectedLanguage,
      translatedText: isToEnglish ? natural : translation,
      naturalEnglish: natural,
      professionalEnglish: confident,
      literal,
      natural,
      confident,
      translation,
      note,
    });
  } catch (err) {
    console.error("[/api/translate] Error:", err);
    return res.status(500).json({
      error: "Backend API process error",
      details: err.message || "Server error",
      translatedText: text,
      naturalEnglish: text,
      professionalEnglish: text,
      status: "error"
    });
  }
});


// ─── REST API: /api/speak ─────────────────────────────────────────────────────
app.post("/api/speak", async (req, res) => {
  const { text } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  try {
    // Check if we should use client-side TTS
    const ttsResult = await runTTS(text, (chunk) => {
      res.write(Buffer.from(chunk));
    });

    if (ttsResult === USE_CLIENT_TTS) {
      // Signal to client to use native Web Speech API
      res.setHeader("Content-Type", "application/json");
      res.json({ useClientTTS: true, text });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.end();
  } catch (err) {
    console.error("[/api/speak] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// ─── REST API: /api/practice/feedback ────────────────────────────────────────
app.post("/api/practice/feedback", async (req, res) => {
  const { transcript, mode = "general", topic = "" } = req.body;

  if (!transcript?.trim()) {
    return res.status(400).json({ error: "transcript is required" });
  }

  try {
    const modePrompts = {
      interview: "The student is practicing for a job/college interview.",
      presentation: "The student is practicing a presentation or speech.",
      viva: "The student is practicing for a viva/oral examination.",
      "group-discussion": "The student is practicing for a group discussion.",
      "daily-conversation": "The student is practicing daily English conversation.",
      "self-introduction": "The student is practicing self-introduction.",
    };

    const modeContext = modePrompts[mode] || "The student is practicing English communication.";

    const model = getGeminiModel();
    const userPrompt = `${modeContext}
${topic ? `Topic: "${topic}"` : ""}

Student said: "${transcript}"

Please provide:
1. A brief positive acknowledgment of what they said well
2. A natural, improved English version of what they said
3. 1-2 specific, actionable communication tips
4. An encouraging message to try again

Keep the response warm, supportive, and under 100 words.`;

    const response = await generateGeminiContent(userPrompt, {
      maxOutputTokens: 2048,
      temperature: 0.7,
    });

    res.json({
      success: true,
      feedback: response.text,
    });
  } catch (err) {
    console.error("[/api/practice/feedback] Error:", err);
    if (isRateLimitOrQuotaError(err)) {
      const rateLimitMsg = formatRateLimitMessage(err);
      return res.json({
        success: true,
        feedback: "Great practice effort! " + rateLimitMsg,
        rateLimited: true,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── REST API: /api/daily-challenge ──────────────────────────────────────────
app.get("/api/daily-challenge", async (req, res) => {
  try {
    const today = new Date().toDateString();

    const userPrompt = `Generate a speaking challenge for today (${today}) for an Indian student learning English.

Respond ONLY in this exact JSON format:
{
  "title": "<short challenge title>",
  "prompt": "<what the student should speak about, in 1-2 sentences>",
  "duration": <seconds as number, between 30-120>,
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "category": "<one of: daily-conversation, interview, presentation, vocabulary, storytelling>"
}`;

    const response = await generateGeminiContent(userPrompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      temperature: 0.9,
    });

    const challenge = JSON.parse(response.text);
    res.json({ success: true, challenge, date: today });
  } catch (err) {
    console.error("[/api/daily-challenge] Error:", err);
    // Fallback challenge if API fails
    res.json({
      success: true,
      challenge: {
        title: "Introduce Yourself",
        prompt: "Speak for 60 seconds about yourself — your name, where you're from, your interests, and your goals.",
        duration: 60,
        tips: ["Speak clearly and at a steady pace", "Use 'I am' and 'I enjoy' sentences", "Smile as you speak — it shows in your voice!"],
        category: "self-introduction",
      },
      date: new Date().toDateString(),
    });
  }
});

// ─── REST API: /api/vocabulary ────────────────────────────────────────────────
app.post("/api/vocabulary", async (req, res) => {
  const { word, context = "" } = req.body;

  if (!word?.trim()) {
    return res.status(400).json({ error: "word is required" });
  }

  try {
    const userPrompt = `Explain the English word/phrase "${word}"${context ? ` used in context: "${context}"` : ""}.

Respond ONLY in this exact JSON format:
{
  "word": "${word}",
  "meaning": "<clear, simple meaning>",
  "pronunciation": "<phonetic pronunciation>",
  "examples": ["<example sentence 1>", "<example sentence 2>"],
  "synonyms": ["<synonym 1>", "<synonym 2>", "<synonym 3>"],
  "indianContext": "<example or tip relevant to Indian students>",
  "difficulty": "<beginner|intermediate|advanced>"
}`;

    const response = await generateGeminiContent(userPrompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      temperature: 0.3,
    });

    const vocab = JSON.parse(response.text);
    res.json({ success: true, ...vocab });
  } catch (err) {
    console.error("[/api/vocabulary] Error:", err);
    const friendlyError = isRateLimitOrQuotaError(err) ? RATE_LIMIT_MESSAGE : err.message;
    res.status(500).json({ error: friendlyError });
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  const conversationHistory = [{ role: "system", content: COACH_SYSTEM_PROMPT }];
  let dgSession = null;
  let isListening = false;
  let keepAliveInterval = null;
  let sessionLanguage = "en-US";

  // ── 1. START LISTENING ──────────────────────────────────────────────────────
  socket.on("start_listening", ({ language = "en-US" } = {}) => {
    sessionLanguage = language;
    if (isListening) return;
    isListening = true;
    console.log(`[Socket] ${socket.id} → start_listening (language: ${language})`);

    dgSession = createLiveSession(
      deepgram,
      socket,
      (finalText) => handleFinalTranscript(finalText, sessionLanguage),
      language
    );

    keepAliveInterval = setInterval(() => {
      if (dgSession && isListening) {
        dgSession.connection.keepAlive();
      }
    }, 8000);
  });

  // ── 2. AUDIO CHUNK ──────────────────────────────────────────────────────────
  let chunkCount = 0;
  socket.on("audio_chunk", (chunk) => {
    chunkCount++;
    if (chunkCount % 20 === 1) {
      const byteLen = chunk?.byteLength ?? chunk?.length ?? typeof chunk;
      console.log(`[audio_chunk] #${chunkCount} | bytes=${byteLen} | session=${!!dgSession} | listening=${isListening}`);
    }

    if (!dgSession || !isListening) return;
    dgSession.send(chunk);
  });

  // ── 3. STOP LISTENING ───────────────────────────────────────────────────────
  socket.on("stop_listening", () => {
    console.log(`[Socket] ${socket.id} → stop_listening`);
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    if (dgSession) {
      dgSession.finish();
      dgSession = null;
    }
    isListening = false;
    socket.emit("listening_stopped");
  });

  // ── 4. TEXT MESSAGE ──────────────────────────────────────────────────────────
  let isProcessingTranscript = false;

  socket.on("text_message", async ({ text, language = sessionLanguage }) => {
    if (!text?.trim()) return;
    if (isProcessingTranscript) {
      console.log(`[Socket] ⏳ Dropping duplicate/concurrent text_message from ${socket.id}`);
      return;
    }
    sessionLanguage = language || sessionLanguage;
    await handleFinalTranscript(text.trim(), sessionLanguage);
  });

  // ── CORE PIPELINE ───────────────────────────────────────────────────────────
  async function handleFinalTranscript(userText, language = "en-US") {
    if (isProcessingTranscript) {
      console.log(`[Pipeline] ⏳ Pipeline already in progress for ${socket.id}, ignoring duplicate request.`);
      return;
    }
    isProcessingTranscript = true;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[Pipeline] 🚀 START — userText: "${userText}" | language: "${language}"`);
    console.log(`${"=".repeat(60)}`);

    try {
      socket.emit("coach_thinking");

      conversationHistory.push({ role: "user", content: userText });

      const targetLangName = getTargetLanguageName(language);
      const langInstruction = `\n\n[MANDATORY INSTRUCTION: The user may have spoken or typed in any language (Hindi, English, Hinglish, Tamil, Telugu, etc.). Understand their message fully. Your response MUST be written in ${targetLangName} (${language}) in simple, natural, conversational phrasing suitable for spoken speech.]`;

      // Build Gemini-compatible history.
      const rawMessages = [
        { role: "user", parts: [{ text: COACH_SYSTEM_PROMPT + langInstruction + "\n\n" }] },
        ...conversationHistory.slice(1).map((m) => ({
          role: m.role === "assistant" || m.role === "bot" ? "model"
               : m.role === "system" ? "user"
               : m.role,
          parts: [{ text: m.content ?? m.text ?? "" }],
        })),
      ];

      const safeHistory = sanitizeGeminiHistory(rawMessages.slice(0, -1));
      let coachReply = "";

      const streamResult = await streamGeminiResponse(
        userText,
        (token) => {
          coachReply += token;
          socket.emit("coach_token", { token });
        },
        safeHistory
      );

      const finalReply = streamResult.reply || coachReply;

      // Store with 'model' role – NEVER 'assistant' – to keep history clean
      conversationHistory.push({ role: "model", content: finalReply });
      socket.emit("coach_reply_complete", { reply: finalReply, language });

      // TTS
      console.log(`[TTS] 📤 Requesting TTS for ${finalReply.length} chars… (language: ${language})`);
      await streamTTS(finalReply, socket, language);
    } catch (err) {
      console.error(`[Pipeline] ❌ Error in pipeline:`, err);
      if (isRateLimitOrQuotaError(err)) {
        const rateLimitMsg = formatRateLimitMessage(err);
        socket.emit("coach_token", { token: rateLimitMsg });
        socket.emit("coach_reply_complete", { reply: rateLimitMsg, language });
        await streamTTS(rateLimitMsg, socket, language);
      } else {
        socket.emit("error", { source: "pipeline", message: err.message });
      }
    } finally {
      isProcessingTranscript = false;
    }
  }

  // ── DISCONNECT ──────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    if (dgSession) {
      dgSession.finish();
      dgSession = null;
    }
    isListening = false;
  });
});

// ─── TTS helper ───────────────────────────────────────────────────────────────
async function streamTTS(text, socket, language = "en-US") {
  try {
    socket.emit("tts_start");
    console.log(`[TTS] ▶ Starting TTS for text (${text.length} chars, language: ${language})`);

    const ttsResult = await runTTS(text, (chunk) => {
      socket.emit("tts_audio_chunk", chunk);
    });

    if (ttsResult === USE_CLIENT_TTS) {
      // Signal to client to use native Web Speech API with target language
      socket.emit("use_client_tts", { text, language });
      console.log(`[TTS] ✅ Using client-side TTS (${language})`);
    } else {
      console.log(`[TTS] ✅ DONE`);
    }
    socket.emit("tts_end");
  } catch (err) {
    console.error("[TTS] ❌ Error:", err);
    socket.emit("error", { source: "tts", message: err.message });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║   ApniAwaaz – AI Multilingual Confidence Coach       ║
  ║   Backend running on :${PORT}                           ║
  ║   Socket.io + REST API ready                         ║
  ╚══════════════════════════════════════════════════════╝
  `);
});

export { app, io };