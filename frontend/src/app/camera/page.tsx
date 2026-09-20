"use client";

/**
 * Camera Practice Page
 * Students can practice speaking on camera with AI communication feedback.
 * IMPORTANT: Feedback is ONLY on communication aspects, never appearance.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CAMERA_PRACTICE_TOPICS } from "@/lib/practiceTopics";
import { getPracticeFeedback } from "@/services/api";
import { recordSession } from "@/store/userStore";

type CameraState = "idle" | "permitting" | "ready" | "recording" | "processing" | "feedback";

export default function CameraPage() {
  const [state, setState] = useState<CameraState>("idle");
  const [selectedTopic, setSelectedTopic] = useState(CAMERA_PRACTICE_TOPICS[0]);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      stopCamera();
      recognitionRef.current?.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async () => {
    setState("permitting");
    setCameraError("");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("ready");
    } catch (err: unknown) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError") {
        setCameraError("Camera/microphone permission denied. Please allow both camera and microphone access.");
      } else if (e.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(`Camera error: ${e.message}`);
      }
      setState("idle");
    }
  }, []);

  const startRecording = useCallback(() => {
    setTranscript("");
    setLiveTranscript("");
    setFeedback("");
    setTimer(0);
    setState("recording");

    // Timer
    timerIntervalRef.current = setInterval(() => {
      setTimer((t) => {
        if (t >= selectedTopic.duration) {
          stopRecording();
          return t;
        }
        return t + 1;
      });
    }, 1000);

    // Speech recognition
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Voice recognition not supported in this browser. Please use Chrome or Edge.");
      setState("ready");
      return;
    }

    const SpeechRecognitionAPI =
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
      window.SpeechRecognition;

    const rec = new SpeechRecognitionAPI();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += t + " ";
        } else {
          interim = t;
        }
      }
      setLiveTranscript(finalText + interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Please allow microphone access.");
      } else if (e.error === "no-speech" || e.error === "network" || e.error === "aborted") {
        // Expected/transient errors - ignore
      } else {
        console.warn(`Speech recognition error: ${e.error}`);
      }
    };

    rec.onend = () => {
      setTranscript(finalText.trim());
    };

    rec.start();
  }, [selectedTopic.duration]);

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    recognitionRef.current?.stop();

    const finalText = transcript || liveTranscript;
    if (finalText.trim()) {
      getFeedback(finalText.trim());
    } else {
      setError("No speech detected. Please try again and speak clearly into the microphone.");
      setState("ready");
    }
  }, [transcript, liveTranscript]);

  const getFeedback = async (text: string) => {
    setState("processing");
    setTranscript(text);

    try {
      const res = await getPracticeFeedback(text, "presentation", selectedTopic.title);
      setFeedback(res.feedback);
      setState("feedback");

      recordSession({
        date: new Date().toDateString(),
        type: "camera",
        durationSeconds: timer,
        wordsSpoken: text.split(" ").length,
        messagesCount: 1,
      });
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to get feedback.");
      setState("ready");
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const tryAgain = () => {
    setTranscript("");
    setLiveTranscript("");
    setFeedback("");
    setTimer(0);
    setState("ready");
  };

  return (
    <div className="relative min-h-full w-full bg-slate-950 py-8 px-4 lg:px-8 select-none">
      <div className="orb w-[400px] h-[400px] -top-20 -left-20 opacity-15"
        style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }} />
      <div className="orb w-[400px] h-[400px] bottom-10 -right-20 opacity-10"
        style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)" }} />

      <div className="relative z-10 max-w-5xl mx-auto w-full">

        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
            <span>📹</span> Video & Vocal Feedback
          </div>
          <h1 className="font-display font-bold text-3xl text-slate-50 mb-2">Camera Practice</h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Practice speaking on camera. Get AI evaluation on your communication — clarity, confidence, and vocabulary.
          </p>
        </motion.div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: Camera view ── */}
          <div className="space-y-4">
            {/* Camera preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative shadow-xl" style={{ aspectRatio: "4/3" }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ display: state === "idle" || state === "permitting" ? "none" : "block" }}
              />

              {(state === "idle" || state === "permitting") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 backdrop-blur-sm">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <span className="text-4xl">📷</span>
                  </div>
                  {state === "permitting" ? (
                    <p className="text-cyan-300 text-sm font-medium">Requesting camera access…</p>
                  ) : (
                    <p className="text-slate-400 text-sm text-center max-w-xs">
                      Camera preview will appear here
                    </p>
                  )}
                </div>
              )}

              {/* Timer overlay when recording */}
              {state === "recording" && (
                <div className="absolute top-3 right-3 bg-red-500/90 px-3 py-1.5 rounded-full text-white text-sm font-mono flex items-center gap-2 shadow-lg shadow-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {formatTime(timer)} / {formatTime(selectedTopic.duration)}
                </div>
              )}
            </div>

            {/* Live transcript during recording */}
            {state === "recording" && liveTranscript && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 mb-1 font-medium">Live transcript:</p>
                <p className="text-slate-200 text-sm italic">{liveTranscript}</p>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-4 text-red-300 text-sm">
                ⚠️ {cameraError}
              </div>
            )}

            {error && (
              <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 text-amber-300 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Control buttons */}
            <div className="flex gap-3">
              {state === "idle" && (
                <button
                  id="start-camera-btn"
                  onClick={startCamera}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2"
                >
                  📷 Start Camera
                </button>
              )}

              {state === "ready" && (
                <>
                  <button
                    id="start-recording-btn"
                    onClick={startRecording}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2"
                  >
                    🎤 Start Speaking
                  </button>
                  <button
                    onClick={() => { stopCamera(); setState("idle"); }}
                    className="px-4 py-3 rounded-xl text-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                  >
                    Stop Camera
                  </button>
                </>
              )}

              {state === "recording" && (
                <button
                  id="stop-recording-btn"
                  onClick={stopRecording}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
                >
                  ■ Stop & Get Feedback
                </button>
              )}

              {state === "feedback" && (
                <>
                  <button id="try-again-btn" onClick={tryAgain}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition">
                    🎤 Try Again
                  </button>
                  <button onClick={() => { setState("ready"); setFeedback(""); }}
                    className="px-4 py-3 rounded-xl text-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition">
                    New Topic
                  </button>
                </>
              )}

              {state === "processing" && (
                <div className="flex-1 flex items-center justify-center gap-3 py-3 text-cyan-300 bg-slate-900 border border-slate-800 rounded-xl text-sm">
                  <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  Analyzing your speech…
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Topics + Feedback ── */}
          <div className="space-y-4">
            {/* Topic selector */}
            {(state === "idle" || state === "ready") && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <p className="text-slate-300 text-sm font-semibold mb-3">Choose a practice topic:</p>
                <div className="space-y-2">
                  {CAMERA_PRACTICE_TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic)}
                      id={`camera-topic-${topic.id}`}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                        selectedTopic.id === topic.id
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-100">{topic.title}</span>
                        <span className="text-xs text-slate-500 font-mono">{topic.duration}s</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Selected topic prompt */}
            {state === "ready" && (
              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-xl shadow-cyan-500/5">
                <p className="text-xs text-cyan-400 mb-2 uppercase tracking-wider font-semibold">Your Topic</p>
                <p className="text-slate-100 font-semibold mb-2">{selectedTopic.title}</p>
                <p className="text-slate-300 text-sm leading-relaxed">"{selectedTopic.prompt}"</p>
                <p className="text-slate-500 text-xs mt-3">
                  ⏱ {selectedTopic.duration} seconds · Communication feedback only
                </p>
              </div>
            )}

            {/* Feedback */}
            <AnimatePresence>
              {state === "feedback" && feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Transcript */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                    <p className="text-xs text-slate-400 mb-2 font-medium">What you said:</p>
                    <p className="text-slate-200 text-sm italic">"{transcript}"</p>
                  </div>

                  {/* AI Feedback */}
                  <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-xl shadow-cyan-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        🤖
                      </div>
                      <div>
                        <p className="text-slate-100 font-semibold text-sm">Communication Feedback</p>
                        <p className="text-slate-400 text-xs">Focus: clarity, confidence, vocabulary</p>
                      </div>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">{feedback}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}


