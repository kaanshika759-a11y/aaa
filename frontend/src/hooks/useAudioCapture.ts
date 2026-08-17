"use client";

/**
 * useAudioCapture – Custom hook for Web Audio API mic capture.
 *
 * Returns:
 *   startCapture(onChunk, onLevel) – opens mic, streams PCM chunks
 *   stopCapture()                  – tears down the audio pipeline
 *   isCapturing                    – boolean ref
 */

import { useRef, useCallback } from "react";

type ChunkCallback = (pcm16Buffer: ArrayBuffer) => void;
type LevelCallback  = (level: number) => void;       // 0–1 normalised

const SAMPLE_RATE = 16_000; // Deepgram optimal
const BUFFER_SIZE = 4_096;

export function useAudioCapture() {
  const streamRef    = useRef<MediaStream | null>(null);
  const ctxRef       = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const rafRef       = useRef<number>(0);
  const isCapturing  = useRef(false);

  const startCapture = useCallback(
    async (onChunk: ChunkCallback, onLevel: LevelCallback) => {
      if (isCapturing.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      ctxRef.current = ctx;

      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        const floatData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(floatData.length);
        for (let i = 0; i < floatData.length; i++) {
          const clamped = Math.max(-1, Math.min(1, floatData[i]));
          pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        onChunk(pcm16.buffer);
      };

      // Level metering animation frame
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
        onLevel(avg / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      isCapturing.current = true;
    },
    []
  );

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    ctxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    processorRef.current = null;
    analyserRef.current  = null;
    ctxRef.current       = null;
    streamRef.current    = null;
    isCapturing.current  = false;
  }, []);

  return { startCapture, stopCapture, isCapturing };
}
