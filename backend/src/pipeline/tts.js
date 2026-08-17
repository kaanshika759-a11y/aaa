/**
 * src/pipeline/tts.js
 * Text-to-Speech module.
 *
 * Default: OpenAI TTS (nova voice, mp3 streaming).
 * Optional: ElevenLabs (set ELEVENLABS_API_KEY in .env).
 */

import fetch from "node-fetch"; // Node 20+ has global fetch; keep for compatibility

/**
 * runTTS – generates audio for `text` and calls `onChunk` with each binary chunk.
 *
 * @param {import("openai").OpenAI} openaiClient
 * @param {string}   text
 * @param {(chunk: Uint8Array) => void} onChunk
 * @returns {Promise<void>}
 */
export async function runTTS(openaiClient, text, onChunk) {
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
    return runElevenLabsTTS(text, onChunk);
  }
  return runOpenAITTS(openaiClient, text, onChunk);
}

// ── OpenAI TTS ─────────────────────────────────────────────────────────────────
async function runOpenAITTS(openaiClient, text, onChunk) {
  const response = await openaiClient.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
    response_format: "mp3",
    speed: 1.0,
  });

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(value);
  }
}

// ── ElevenLabs TTS (streaming) ─────────────────────────────────────────────────
async function runElevenLabsTTS(text, onChunk) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4 },
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS error: ${err}`);
  }

  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(value);
  }
}
