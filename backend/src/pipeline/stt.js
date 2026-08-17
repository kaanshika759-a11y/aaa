/**
 * src/pipeline/stt.js
 * ============================================================
 *  Speech-to-Text module — Deepgram live streaming (nova-2)
 * ============================================================
 *
 *  Key design decisions:
 *  ─────────────────────
 *  • encoding=linear16 + sample_rate=16000  → must match the Int16Array PCM
 *    that page.tsx sends via the audio_chunk socket event.
 *
 *  • interim_results=true  → Deepgram sends partial (is_final=false) results
 *    as the user speaks so the UI can show live text. We emit these to the
 *    frontend but do NOT trigger the LLM for them.
 *
 *  • endpointing=300  → after 300 ms of silence Deepgram marks the current
 *    utterance as is_final=true. This is the ONLY gate before the LLM runs.
 *    Without endpointing, is_final can be arbitrarily delayed.
 *
 *  • utterance_end_ms=1000  → a secondary safety-net: if endpointing fires
 *    but the transcript is still building, UtteranceEnd gives us one more
 *    chance to flush any accumulated text.
 *
 *  • vad_events=true  → gives us SpeechStarted / UtteranceEnd events for
 *    better UI feedback and the UtteranceEnd flush strategy.
 *
 *  Exported API
 *  ────────────
 *  createLiveSession(dgClient, socket, onFinalTranscript)
 *    → returns { send(buffer), finish() }
 *
 *  runSTT(client, audioBuffer, mimeType)   ← one-shot prerecorded fallback
 */

// ─── Live streaming session factory ──────────────────────────────────────────

/**
 * createLiveSession
 *
 * Opens a Deepgram WebSocket, wires all event handlers, and returns a thin
 * wrapper so server.js only needs to call .send() and .finish().
 *
 * @param {import("@deepgram/sdk").DeepgramClient} dgClient
 * @param {import("socket.io").Socket}             socket      – client socket for emitting events
 * @param {(text: string) => void}                 onFinalTranscript – called when is_final=true & text is non-empty
 * @returns {{ send: (buf: Buffer) => void, finish: () => void, connection: object }}
 */
export function createLiveSession(dgClient, socket, onFinalTranscript) {
  // ── Deepgram live config ────────────────────────────────────────────────────
  //
  //  ┌─────────────────────────────────────────────────────────────────────┐
  //  │  WHY EACH PARAM EXISTS                                              │
  //  │                                                                     │
  //  │  encoding     : "linear16"  ← browser sends Int16Array (signed 16) │
  //  │  sample_rate  : 16000       ← AudioContext sampleRate in page.tsx  │
  //  │  channels     : 1           ← mono mic                             │
  //  │  interim_results: true      ← stream partial text to UI in real-time│
  //  │  endpointing  : 300         ← ms of silence → fires is_final=true  │
  //  │  utterance_end_ms: 1000     ← UtteranceEnd flush fallback          │
  //  │  vad_events   : true        ← SpeechStarted / UtteranceEnd events  │
  //  │  smart_format : true        ← punctuation, casing, numbers         │
  //  └─────────────────────────────────────────────────────────────────────┘
  const connection = dgClient.listen.live({
    model:             "nova-2",
    language:          "en-US",
    encoding:          "linear16",
    sample_rate:       16000,
    channels:          1,
    interim_results:   true,
    endpointing:       300,       // ← 300 ms silence → is_final fires quickly
    utterance_end_ms:  1000,
    vad_events:        true,
    smart_format:      true,
  });

  // ── Internal state ──────────────────────────────────────────────────────────
  // We accumulate interim text so UtteranceEnd can flush if needed.
  let interimAccumulator = "";
  let finalAlreadyFired  = false; // prevent double-LLM on same utterance

  // ── Event: connection open ──────────────────────────────────────────────────
  connection.on("open", () => {
    console.log(`[STT] ✅ Deepgram WebSocket OPEN`);
    console.log(`[STT]    encoding=linear16  sample_rate=16000  endpointing=300`);
    socket.emit("listening_started");
  });

  // ── Event: Results (interim + final) ───────────────────────────────────────
  connection.on("Results", (data) => {
    const alt        = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript ?? "";
    const confidence = alt?.confidence ?? 0;
    const isFinal    = data.is_final    ?? false;
    const speechFinal = data.speech_final ?? false;

    // Always log so you can see what Deepgram is sending
    console.log(
      `[STT] Results | isFinal=${isFinal} | speech_final=${speechFinal}` +
      ` | conf=${confidence.toFixed(2)} | text="${transcript}"`
    );

    // ── Interim result (is_final = false) ────────────────────────────────────
    // Update the accumulator and show live text on the frontend.
    // Do NOT trigger the LLM — just display for real-time feedback.
    if (!isFinal) {
      if (transcript) {
        interimAccumulator = transcript; // replace with latest partial
        console.log(`[STT]   ↳ interim — emitting to UI: "${transcript}"`);
        // Emit isFinal=false so the frontend renders it as a "live" bubble
        socket.emit("transcript", { transcript, isFinal: false });
      }
      return; // ← never call LLM on interim results
    }

    // ── Final result (is_final = true) ───────────────────────────────────────
    // Prefer the Deepgram-provided transcript; fall back to the accumulator
    // in case this final result itself is empty (can happen on silence frames).
    const finalText = (transcript.trim() || interimAccumulator.trim());

    // Reset for next utterance
    interimAccumulator = "";
    finalAlreadyFired  = false;

    if (!finalText) {
      console.log(`[STT]   ↳ Final result with empty transcript — skipping LLM`);
      return;
    }

    console.log(`[STT] ✅ FINAL transcript: "${finalText}"`);

    // Emit the confirmed final text to frontend (marks it as a committed bubble)
    socket.emit("transcript", { transcript: finalText, isFinal: true });

    // ── Hand off to LLM ──────────────────────────────────────────────────────
    // Guard: only fire once per utterance (speech_final can arrive on the same
    // frame as is_final, which would otherwise call onFinalTranscript twice).
    if (!finalAlreadyFired) {
      finalAlreadyFired = true;
      console.log(`[STT] 🚀 Handing off to LLM pipeline: "${finalText}"`);
      onFinalTranscript(finalText);
    }
  });

  // ── Event: SpeechStarted ────────────────────────────────────────────────────
  connection.on("SpeechStarted", () => {
    console.log(`[STT] 🎙️  Speech STARTED — resetting accumulator`);
    interimAccumulator = "";
    finalAlreadyFired  = false;
  });

  // ── Event: UtteranceEnd ─────────────────────────────────────────────────────
  // This fires ~utterance_end_ms after speech stops. It is a safety-net:
  // if endpointing has NOT yet sent a final result but we have accumulated
  // interim text, flush it now so the LLM still gets called.
  connection.on("UtteranceEnd", (data) => {
    console.log(`[STT] 🔇 UtteranceEnd received`, JSON.stringify(data));

    const flushText = interimAccumulator.trim();
    if (flushText && !finalAlreadyFired) {
      console.log(`[STT] ⚡ UtteranceEnd flush — sending accumulated text to LLM: "${flushText}"`);
      finalAlreadyFired  = true;
      interimAccumulator = "";
      // Emit the flushed transcript as final to the frontend
      socket.emit("transcript", { transcript: flushText, isFinal: true });
      onFinalTranscript(flushText);
    } else {
      console.log(`[STT]   ↳ UtteranceEnd — nothing to flush (accumulator empty or already fired)`);
    }
  });

  // ── Event: Metadata ─────────────────────────────────────────────────────────
  connection.on("Metadata", (meta) => {
    console.log(`[STT] Metadata:`, JSON.stringify(meta));
  });

  // ── Event: error ────────────────────────────────────────────────────────────
  connection.on("error", (err) => {
    console.error(`[STT] ❌ Deepgram error:`, err);
    socket.emit("error", { source: "stt", message: err?.message ?? String(err) });
  });

  // ── Event: close ────────────────────────────────────────────────────────────
  connection.on("close", () => {
    console.log(`[STT] 🔌 Deepgram WebSocket CLOSED`);
  });

  // ── Public interface ────────────────────────────────────────────────────────
  return {
    /**
     * send – forward a raw PCM Buffer to Deepgram.
     * Accepts Buffer | Uint8Array | ArrayBuffer (normalises internally).
     */
    send(chunk) {
      const buf = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk instanceof ArrayBuffer ? chunk : chunk.buffer ?? chunk);
      connection.send(buf);
    },

    /** finish – gracefully close the Deepgram WebSocket. */
    finish() {
      try { connection.finish(); } catch (_) { /* already closed */ }
    },

    /** Expose raw connection for keepAlive pings */
    connection,
  };
}

// ─── One-shot prerecorded transcription (fallback / testing) ─────────────────

/**
 * runSTT – transcribes a complete audio buffer (non-streaming).
 * Useful for testing or for processing pre-recorded files.
 *
 * @param {import("@deepgram/sdk").DeepgramClient} client
 * @param {Buffer}  audioBuffer
 * @param {string}  mimeType   e.g. "audio/webm"
 * @returns {Promise<string>} transcript text
 */
export async function runSTT(client, audioBuffer, mimeType = "audio/webm") {
  console.log(`[STT] runSTT (prerecorded) — ${audioBuffer.byteLength} bytes, mime=${mimeType}`);

  const { result, error } = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model:        "nova-2",
      smart_format: true,
      language:     "en-US",
      mimetype:     mimeType,
    }
  );

  if (error) throw new Error(`Deepgram STT error: ${error.message}`);

  const transcript = result.results.channels[0].alternatives[0].transcript ?? "";
  console.log(`[STT] runSTT result: "${transcript}"`);
  return transcript;
}
