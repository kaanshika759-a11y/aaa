"use client";

import React, { useState, useEffect, useRef } from "react";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { listenSpeech, speakResponse, SpeechSession } from "@/services/speechService";

export default function Translator() {
    const [sourceLang, setSourceLang] = useState("hi-IN");
    const [targetLang, setTargetLang] = useState("en-IN");
    const [inputText, setInputText] = useState("");
    const [translatedText, setTranslatedText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const sessionRef = useRef<SpeechSession | null>(null);

    useEffect(() => {
        return () => {
            if (sessionRef.current) {
                sessionRef.current.stop();
                sessionRef.current = null;
            }
        };
    }, []);

    // Translation handler via Google Gemini Backend
    const handleTranslate = async (textToTranslate?: string) => {
        const text = (textToTranslate !== undefined ? textToTranslate : inputText).trim();
        if (!text) return;

        setIsLoading(true);
        setErrorMsg("");

        const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);
        const targetLangName = targetLangObj ? targetLangObj.name : "English";

        try {
            const response = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: text,
                    sourceText: text,
                    fromLang: sourceLang,
                    toLang: targetLang,
                    targetLang: targetLangName,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Translation failed.");
            }

            const result =
                data.translation ||
                data.translatedText ||
                data.natural ||
                data.literal ||
                data.reply ||
                "";
            setTranslatedText(result);

            if (result) {
                speakResponse(result, targetLang);
            }
        } catch (err: any) {
            console.error("Translation Error:", err);
            setErrorMsg(err.message || "Failed to fetch translation. Check backend connection.");
        } finally {
            setIsLoading(false);
        }
    };

    // Voice Input Toggle using robust listenSpeech
    const toggleListening = async () => {
        if (isListening || sessionRef.current) {
            if (sessionRef.current) {
                sessionRef.current.stop();
                sessionRef.current = null;
            }
            setIsListening(false);
            return;
        }

        setErrorMsg("");
        setIsListening(true);

        const session = await listenSpeech({
            language: sourceLang,
            continuous: false,
            onResult: (text: string, isFinal: boolean) => {
                setInputText(text);
                if (isFinal) {
                    setIsListening(false);
                    if (sessionRef.current) {
                        sessionRef.current.stop();
                        sessionRef.current = null;
                    }
                    handleTranslate(text);
                }
            },
            onError: (err: string) => {
                setErrorMsg(err);
                setIsListening(false);
            },
            onEnd: () => {
                setIsListening(false);
            },
        });

        if (!session) {
            setIsListening(false);
            return;
        }

        sessionRef.current = session;
    };

    // Text-to-Speech playback
    const speakText = (text: string, langCode: string) => {
        if (!text.trim()) return;
        speakResponse(text, langCode);
    };

    return (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">

            {/* Language Selection Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                    <label htmlFor="source-language-select" className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        Translate From
                    </label>
                    <select
                        id="source-language-select"
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition cursor-pointer"
                    >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100 py-1.5">
                                {lang.name} ({lang.nativeName})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="target-language-select" className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        Translate To
                    </label>
                    <select
                        id="target-language-select"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition cursor-pointer"
                    >
                        {SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100 py-1.5">
                                {lang.name} ({lang.nativeName})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Input / Output Box Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Source Text Input */}
                <div className="flex flex-col justify-between bg-slate-950 border border-slate-800 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30 rounded-xl p-4 min-h-[200px] transition-all">
                    <textarea
                        id="translator-source-input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type or speak what you want to translate..."
                        className="w-full bg-slate-950 text-slate-100 placeholder:text-slate-400 placeholder:opacity-90 resize-none text-sm font-medium focus:outline-none h-32 leading-relaxed selection:bg-cyan-500/30 selection:text-white"
                        aria-label="Source text to translate"
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                            type="button"
                            id="translator-mic-btn"
                            onClick={toggleListening}
                            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                                isListening
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            }`}
                            title="Speak Input"
                            aria-label="Voice input"
                        >
                            <span>🎤</span>
                            <span>{isListening ? "Listening..." : "Speak"}</span>
                        </button>

                        <button
                            type="button"
                            id="translate-submit-btn"
                            onClick={() => handleTranslate()}
                            disabled={isLoading || !inputText.trim()}
                            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                    <span>Translating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Translate</span>
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Translated Text Output */}
                <div className="flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[200px]">
                    <div className="h-32 overflow-y-auto">
                        {translatedText ? (
                            <p id="translated-output-text" className="text-cyan-300 text-base font-semibold leading-relaxed selection:bg-cyan-500/30">
                                {translatedText}
                            </p>
                        ) : (
                            <p className="text-slate-400 text-sm italic leading-relaxed">
                                Translation will appear here...
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                            type="button"
                            id="translator-listen-btn"
                            onClick={() => speakText(translatedText, targetLang)}
                            disabled={!translatedText}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                            title="Listen Translation"
                            aria-label="Listen to translated text"
                        >
                            <span>🔊</span>
                            <span>Listen</span>
                        </button>

                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                            Powered by Gemini AI
                        </span>
                    </div>
                </div>

            </div>

            {/* Error Alert Message */}
            {errorMsg && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{errorMsg}</span>
                    </span>
                    <button type="button" onClick={() => setErrorMsg("")} className="text-rose-300 hover:text-white text-sm">✕</button>
                </div>
            )}

        </div>
    );
}