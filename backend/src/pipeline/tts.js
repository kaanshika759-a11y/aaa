/**
 * src/pipeline/tts.js
 * Text-to-Speech module.
 *
 * Options:
 * 1. ElevenLabs (set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID in .env)
 * 2. Client-side via Web Speech API (SpeechSynthesis) - default when no server TTS configured
 *
 * The frontend already implements native TTS using the Web Speech API.
 * When no server-side TTS provider is configured, the backend signals the client to use native TTS.
 */

import 'dotenv/config';

// Disable TLS certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Sentinel value to indicate client-side TTS should be used
export const USE_CLIENT_TTS = "USE_CLIENT_TTS";

/**
 * runTTS – generates audio for `text` and calls `onChunk` with each binary chunk.
 *
 * @param {string} text
 * @param {(chunk: Uint8Array) => void} onChunk
 * @returns {Promise<void|"USE_CLIENT_TTS">} Returns USE_CLIENT_TTS if client-side TTS should be used
 */
export async function runTTS(text, onChunk) {
  // Priority: ElevenLabs > Client-side TTS
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID) {
    return runElevenLabsTTS(text, onChunk);
  }
  
  // No server-side TTS configured - use client-side Web Speech API
  console.log("[TTS] No server TTS configured, using client-side SpeechSynthesis");
  return USE_CLIENT_TTS;
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