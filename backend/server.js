/**
 * ============================================================
 *  ApniAwaaz – Voice-to-Voice AI Confidence Coach
 *  Backend: Express + Socket.io
 * ============================================================
 *
 *  Pipeline per session:
 *    Mic (browser) → WebSocket → STT → LLM → TTS → WebSocket → Speaker (browser)
 *
 *  ENV variables (create a .env file):
 *    PORT=4000
 *    DEEPGRAM_API_KEY=your_deepgram_key
 *    OPENAI_API_KEY=your_openai_key          # or GOOGLE_API_KEY for Gemini
 *    ELEVENLABS_API_KEY=your_elevenlabs_key
 *    CLIENT_ORIGIN=http://localhost:3000
 */

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import OpenAI from "openai";
import { createLiveSession } from "./src/pipeline/stt.js";

dotenv.config();

// ─── Express & HTTP Server ────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

// Health-check endpoint
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  // Use binary for raw PCM / opus audio chunks
  transports: ["websocket"],
});

// ─── Deepgram client (STT) ────────────────────────────────────────────────────
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);

// ─── OpenAI client (LLM) ─────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System prompt for the Confidence Coach ───────────────────────────────────
const SYSTEM_PROMPT = `You are ApniAwaaz, an empathetic, expert AI Confidence Coach.
Your role is to help users improve their public speaking, personal confidence, and communication skills.
Listen carefully to what the user says, offer thoughtful, constructive feedback, and
encourage them with actionable tips. Keep responses concise (2-4 sentences max) so they
can be quickly converted to speech. Speak in a warm, supportive, and motivating tone.`;

// ─── Socket event handlers ────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Conversation history per socket session
  const conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];

  // Deepgram live transcription session (created per socket session via stt.js)
  let dgSession    = null; // { send, finish, connection } from createLiveSession()
  let isListening  = false;

  // ── Deepgram keepAlive interval (prevents idle-timeout at ~10 s) ────────────
  let keepAliveInterval = null;

  // ── 1. START LISTENING ──────────────────────────────────────────────────────
  socket.on("start_listening", () => {
    if (isListening) return;
    isListening = true;
    console.log(`[Socket] ${socket.id} → start_listening`);

    // createLiveSession (stt.js) opens the Deepgram WebSocket, wires ALL
    // event handlers (open / Results / SpeechStarted / UtteranceEnd / error /
    // close), and calls onFinalTranscript only when is_final=true AND the
    // accumulated text is non-empty. interim results are forwarded to the
    // frontend for real-time display but never trigger the LLM.
    //
    // Config baked into createLiveSession:
    //   encoding=linear16  sample_rate=16000  channels=1
    //   interim_results=true  endpointing=300  utterance_end_ms=1000
    dgSession = createLiveSession(
      deepgram,
      socket,
      (finalText) => handleFinalTranscript(finalText) // ← LLM gate
    );

    // Send a keepAlive ping every 8 s so Deepgram doesn't close on silence
    keepAliveInterval = setInterval(() => {
      if (dgSession && isListening) {
        dgSession.connection.keepAlive();
        console.log(`[Socket] keepAlive ping → Deepgram (${socket.id})`);
      }
    }, 8000);
  });

  // ── 2. AUDIO CHUNK (raw linear16 PCM from browser mic) ─────────────────────
  let chunkCount = 0;
  socket.on("audio_chunk", (chunk) => {
    chunkCount++;

    // Log every 20th chunk — enough to confirm the stream is flowing without
    // flooding the console.
    if (chunkCount % 20 === 1) {
      const byteLen = chunk?.byteLength ?? chunk?.length ?? typeof chunk;
      console.log(
        `[audio_chunk] #${chunkCount} | bytes=${byteLen}` +
        ` | session=${!!dgSession} | listening=${isListening}`
      );
    }

    if (!dgSession || !isListening) {
      if (chunkCount <= 5) {
        console.warn(
          `[audio_chunk] ⚠️  Chunk #${chunkCount} dropped — ` +
          `session=${!!dgSession}, listening=${isListening}`
        );
      }
      return;
    }

    // stt.js .send() handles Buffer normalisation internally
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

  // ── 4. TEXT MESSAGE (fallback / text mode) ──────────────────────────────────
  socket.on("text_message", async ({ text }) => {
    if (!text?.trim()) return;
    await handleFinalTranscript(text.trim());
  });

  // ── CORE PIPELINE ───────────────────────────────────────────────────────────
  /**
   * handleFinalTranscript
   * 1. Add user message to history
   * 2. Get LLM response (streaming)
   * 3. Convert LLM text to speech
   * 4. Stream audio back to client
   */
  async function handleFinalTranscript(userText) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Pipeline] 🚀 START — userText: "${userText}"`);
    console.log(`[Pipeline] Conversation history length: ${conversationHistory.length}`);
    console.log(`${'='.repeat(60)}`);

    try {
      socket.emit("coach_thinking"); // show "thinking" indicator

      // ── LLM ──────────────────────────────────────────────────────────────
      conversationHistory.push({ role: "user", content: userText });
      console.log(`[LLM] 📤 Sending ${conversationHistory.length} messages to GPT-4o-mini…`);

      let coachReply = "";
      let tokenCount = 0;

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversationHistory,
        stream: true,
        max_tokens: 200,
        temperature: 0.8,
      });

      console.log(`[LLM] ✅ Stream opened — receiving tokens…`);

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        coachReply += token;
        tokenCount++;
        socket.emit("coach_token", { token });
      }

      console.log(`[LLM] ✅ Stream complete — ${tokenCount} tokens | reply: "${coachReply.substring(0, 100)}…"`);

      conversationHistory.push({ role: "assistant", content: coachReply });
      socket.emit("coach_reply_complete", { reply: coachReply });

      // ── TTS ──────────────────────────────────────────────────────────────
      console.log(`[TTS] 📤 Requesting TTS for ${coachReply.length} chars…`);
      await streamTTS(coachReply, socket);
      console.log(`[Pipeline] ✅ END — full pipeline complete for "${userText.substring(0, 40)}"`);

    } catch (err) {
      console.error(`[Pipeline] ❌ FATAL ERROR:`, err);
      console.error(`[Pipeline] Stack:`, err.stack);
      socket.emit("error", { source: "pipeline", message: err.message });
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
/**
 * streamTTS – converts text to speech and emits audio chunks back to the client.
 * Uses OpenAI TTS by default; swap for ElevenLabs or Google by editing this fn.
 */
async function streamTTS(text, socket) {
  try {
    socket.emit("tts_start");
    console.log(`[TTS] ▶ Starting OpenAI TTS for text (${text.length} chars)`);

    // OpenAI TTS (streaming)
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // warm, confident voice
      input: text,
      response_format: "mp3",
    });

    console.log(`[TTS] ✅ API response received — streaming chunks to client`);

    // Convert the ReadableStream to a Buffer and send in chunks
    const reader = response.body.getReader();
    let ttsChunkCount = 0;
    let ttsByteTotal = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      ttsChunkCount++;
      ttsByteTotal += value.byteLength;
      socket.emit("tts_audio_chunk", value); // send Uint8Array chunk
      if (ttsChunkCount % 5 === 1) {
        console.log(`[TTS] Chunk #${ttsChunkCount} emitted | ${value.byteLength} bytes | total=${ttsByteTotal}`);
      }
    }

    console.log(`[TTS] ✅ DONE — ${ttsChunkCount} chunks, ${ttsByteTotal} bytes total`);
    socket.emit("tts_end");
  } catch (err) {
    console.error("[TTS] ❌ Error:", err);
    console.error("[TTS] Stack:", err.stack);
    socket.emit("error", { source: "tts", message: err.message });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║      ApniAwaaz Backend – running on :${PORT}        ║
  ║      Socket.io ready for voice connections       ║
  ╚══════════════════════════════════════════════════╝
  `);
});

export { app, io };
