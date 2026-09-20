import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
];

function getAvailableKeys(): string[] {
    const raw = [
        process.env.GEMINI_API_KEYS,
        process.env.GEMINI_API_KEY,
        process.env.NEXT_PUBLIC_GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
    ];
    const keys: string[] = [];
    for (const item of raw) {
        if (!item) continue;
        for (const k of item.split(",")) {
            const clean = k.trim();
            if (clean && !keys.includes(clean)) {
                keys.push(clean);
            }
        }
    }
    return keys;
}

/**
 * Robust fallback translation service when Gemini API quota or rate limits are reached.
 */
async function fallbackTranslate(
    text: string,
    fromLang: string = "hi",
    toLang: string = "en"
): Promise<string | null> {
    try {
        const from = fromLang.split("-")[0].toLowerCase();
        const to = toLang.split("-")[0].toLowerCase();
        const pair = `${from || "hi"}|${to || "en"}`;

        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
        const res = await fetch(url, {
            headers: { "User-Agent": "ApniAwaaz-Translator/1.0" },
            cache: "no-store",
        });

        if (res.ok) {
            const data = await res.json();
            const translated = data?.responseData?.translatedText;
            if (translated && typeof translated === "string" && translated.trim()) {
                return translated.trim();
            }
        }
    } catch (err) {
        console.warn("[/api/translate] Fallback translation service error:", err);
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const userMessage =
            body.text || body.sourceText || body.message || body.prompt || body.input || "";
        const targetLang =
            body.targetLang || body.targetLanguage || body.toLang || body.to || "English";
        const fromLang = body.fromLang || body.sourceLang || body.from || "hi-IN";
        const toLang = body.toLang || body.to || "en-IN";

        if (!userMessage || !userMessage.trim()) {
            return NextResponse.json(
                { error: "Please enter or speak text to translate." },
                { status: 400 }
            );
        }

        const trimmedInput = userMessage.trim();
        const keys = getAvailableKeys();
        let responseText = "";
        let lastError: any = null;

        // 1. Primary: Try Gemini AI with all pooled keys and models
        if (keys.length > 0) {
            const prompt = `You are ApniAwaaz AI translation & speech coach.
Task: Translate or respond to the following text naturally in ${targetLang}.
Text: "${trimmedInput}"

Respond in simple text without markdown formatting.`;

            for (const key of keys) {
                const genAI = new GoogleGenerativeAI(key);

                for (const modelName of CANDIDATE_MODELS) {
                    try {
                        const model = genAI.getGenerativeModel({
                            model: modelName,
                            generationConfig: {
                                maxOutputTokens: 2048,
                                temperature: 0.3,
                            },
                        });

                        const result = await model.generateContent(prompt);
                        const text = result.response.text().trim();
                        if (text) {
                            responseText = text;
                            break;
                        }
                    } catch (err: any) {
                        lastError = err;
                        console.warn(
                            `[/api/translate] Gemini ${modelName} with key ${key.substring(0, 8)}... error:`,
                            err.message
                        );
                    }
                }
                if (responseText) break;
            }
        }

        // 2. High-Availability Fallback: When Gemini is rate-limited or unavailable
        if (!responseText) {
            console.warn(
                "[/api/translate] Gemini rate-limited or unavailable. Invoking high-availability translation fallback."
            );
            const fallbackResult = await fallbackTranslate(trimmedInput, fromLang, toLang);
            if (fallbackResult) {
                responseText = fallbackResult;
            }
        }

        // 3. If both failed, return a user-friendly translation or message rather than 500 crash
        if (!responseText) {
            if (lastError) {
                console.error("[/api/translate] Exhausted all options:", lastError);
            }
            return NextResponse.json(
                {
                    error: "Translation service temporarily busy. Please try again in a few moments.",
                    details: lastError?.message ?? "Rate limit or connection timeout",
                },
                { status: 503 }
            );
        }

        return NextResponse.json({
            success: true,
            status: "success",
            reply: responseText,
            translatedText: responseText,
            translation: responseText,
            natural: responseText,
            confident: responseText,
            text: responseText,
            message: responseText,
        });
    } catch (error: any) {
        console.error("Gemini Route Error:", error);
        return NextResponse.json(
            { error: "Failed to generate translation response", details: error.message },
            { status: 500 }
        );
    }
}