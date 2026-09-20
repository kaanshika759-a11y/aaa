import React from "react";
import Link from "next/link";

export default function DashboardPage() {
    return (
        <div className="min-h-screen w-full bg-[#0b0f19] text-white overflow-y-auto px-4 py-4 md:px-8">
            <div className="max-w-6xl mx-auto space-y-4">

                {/* Top Hero Banner */}
                <section className="text-center py-2 space-y-2">
                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Build Confidence. Speak Better.
                    </h1>
                    <p className="text-slate-400 text-xs md:text-sm max-w-2xl mx-auto">
                        Your personal AI coach for English confidence. Speak in Hindi, Tamil, Bengali or any Indian language — and learn to express it naturally in English.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-300 pt-1">
            <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
              🔥 1 day streak
            </span>
                        <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
              👤 1 sessions
            </span>
                        <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
              ⏱️ 4m 17s practiced
            </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <Link
                            href="/coach"
                            className="px-5 py-2 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs shadow-lg inline-block"
                        >
                            Start Practice
                        </Link>
                        <button className="px-5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl transition-all text-xs">
                            ✨ Personalize for me
                        </button>
                    </div>
                </section>

                {/* Quick Actions Grid - Routes Exact Folder Structure Ke Hisab Se Set Hain */}
                <section className="pt-1 pb-8">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        QUICK ACTIONS
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Card 1: AI Coach */}
                        <Link
                            href="/coach"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center mb-2 text-cyan-400 font-bold text-base">
                                    🤖
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                                    AI Coach
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Talk, ask, practice — your personal coach
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                        {/* Card 2: Translator */}
                        <Link
                            href="/translator"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center mb-2 text-blue-400 font-bold text-base">
                                    🌐
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                                    Translator
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Hindi, Tamil, Bengali → Confident English
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                        {/* Card 3: Practice */}
                        <Link
                            href="/practice"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-2 text-emerald-400 font-bold text-base">
                                    🎯
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                                    Practice
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Interview, presentation, visa, debate
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                        {/* Card 4: Camera Practice */}
                        <Link
                            href="/camera"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-center mb-2 text-purple-400 font-bold text-base">
                                    📷
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-purple-400 transition-colors">
                                    Camera Practice
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Body language & facial feedback
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-purple-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                        {/* Card 5: Daily Challenge */}
                        <Link
                            href="/daily"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center mb-2 text-amber-400 font-bold text-base">
                                    ⚡
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                                    Daily Challenge
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Complete daily speaking tasks
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-amber-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                        {/* Card 6: Vocabulary */}
                        <Link
                            href="/vocabulary"
                            className="p-4 bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 rounded-xl transition-all shadow-lg group cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-8 h-8 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center justify-center mb-2 text-rose-400 font-bold text-base">
                                    📚
                                </div>
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-rose-400 transition-colors">
                                    Vocabulary
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Learn new words & expressions
                                </p>
                            </div>
                            <div className="text-xs font-semibold text-rose-400 flex items-center gap-1 mt-3">
                                Open →
                            </div>
                        </Link>

                    </div>
                </section>

            </div>
        </div>
    );
}