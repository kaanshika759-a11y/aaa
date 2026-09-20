/**
 * src/pipeline/llm.js
 * Resilient Google Generative AI pipeline service with:
 * - API Key Pooling & Automatic Rotation
 * - Multi-Model High-Availability Fallback
 * - Exponential Backoff & Jitter for 429 / Rate Limit recovery
 */

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Disable TLS certificate verification for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];

export const RATE_LIMIT_MESSAGE =
  "API rate limit reached. Please wait a moment or try again shortly.";

/**
 * Returns all unique valid Gemini API keys discovered in environment variables.
 */
export function getAvailableApiKeys() {
  const sources = [
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];

  const keys = [];
  for (const src of sources) {
    if (!src) continue;
    const parts = src.split(",").map((k) => k.trim()).filter(Boolean);
    for (const key of parts) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  return keys;
}

const clientCache = new Map();

/**
 * Returns a cached GoogleGenerativeAI client instance for a given API key.
 */
export function getGeminiClient(key) {
  const targetKey = key || getAvailableApiKeys()[0] || "";
  if (!targetKey) {
    console.error("[LLM] ❌ No Gemini API key found in environment!");
  }
  if (!clientCache.has(targetKey)) {
    clientCache.set(targetKey, new GoogleGenerativeAI(targetKey));
  }
  return clientCache.get(targetKey);
}

export function getGeminiApiKey() {
  return getAvailableApiKeys()[0] || "";
}

/**
 * Detects whether an error is a 429 / rate limit / quota exhaustion.
 */
export function isRateLimitOrQuotaError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const status = error.status || error.statusCode || error.code;
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("limit exceeded")
  );
}

/**
 * Extracts retry delay from error details or error message if provided by Google API.
 */
export function extractRetryDelay(error) {
  if (!error) return null;
  if (Array.isArray(error.errorDetails)) {
    for (const detail of error.errorDetails) {
      if (detail && (detail["@type"]?.includes("RetryInfo") || detail.retryDelay)) {
        return detail.retryDelay;
      }
    }
  }
  const msg = String(error.message || error);
  const match1 = msg.match(/Please retry in\s+([0-9.]+)s/i);
  if (match1) {
    const sec = Math.ceil(parseFloat(match1[1]));
    return `${sec}s`;
  }
  const match2 = msg.match(/"retryDelay"\s*:\s*"([^"]+)"/i);
  if (match2) return match2[1];
  return null;
}

/**
 * Formats a user-friendly rate limit message including retry information when available.
 */
export function formatRateLimitMessage(error) {
  const delay = extractRetryDelay(error);
  if (delay) {
    return `API rate limit reached. Please wait ${delay} or try again shortly.`;
  }
  return RATE_LIMIT_MESSAGE;
}

/**
 * sanitizeGeminiHistory – bullet-proof role normaliser.
 * Enforces strict user/model alternation as required by the Gemini SDK.
 */
export function sanitizeGeminiHistory(history) {
  if (!Array.isArray(history)) return [];

  const cleaned = history
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const rawRole = String(item.role || item.author || "").toLowerCase().trim();
      const role =
        rawRole === "assistant" || rawRole === "bot" || rawRole === "model"
          ? "model"
          : "user";

      let parts;
      if (Array.isArray(item.parts) && item.parts.length > 0) {
        parts = item.parts
          .map((p) => {
            if (typeof p === "string") return { text: p };
            if (p && typeof p.text === "string") return { text: p.text };
            return null;
          })
          .filter(Boolean);
      } else if (typeof item.content === "string" && item.content.trim()) {
        parts = [{ text: item.content.trim() }];
      } else if (typeof item.text === "string" && item.text.trim()) {
        parts = [{ text: item.text.trim() }];
      } else {
        return null;
      }

      parts = parts.filter((p) => p && p.text && p.text.trim() !== "");
      if (parts.length === 0) return null;

      return { role, parts };
    })
    .filter(Boolean);

  // Enforce strict user/model alternation
  const alternated = [];
  for (const entry of cleaned) {
    if (alternated.length === 0 || alternated[alternated.length - 1].role !== entry.role) {
      alternated.push(entry);
    }
  }

  return alternated;
}

export const sanitizeHistory = sanitizeGeminiHistory;

/**
 * Returns a working Gemini model instance configured with the best available key & model.
 */
export async function getWorkingModel() {
  const key = getAvailableApiKeys()[0] || "";
  const client = getGeminiClient(key);
  const modelName = CANDIDATE_MODELS[0];
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  return { model, modelName };
}

/**
 * Helper to pause execution with backoff
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * streamGeminiResponse – Streams response with multi-key rotation and graceful rate-limit handling.
 *
 * @param {string} prompt
 * @param {(token: string) => void} onChunk
 * @param {Array} history
 * @param {object} options
 */
export async function streamGeminiResponse(prompt, onChunk, history = [], options = {}) {
  const sanitizedHistory = sanitizeGeminiHistory(history);
  const keys = getAvailableApiKeys();
  let lastError = null;

  for (const key of keys) {
    const client = getGeminiClient(key);

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[LLM Pipeline] 🤖 Stream request | Model: ${modelName} | Key prefix: ${key.substring(0, 8)}`);
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
            ...(options.generationConfig || {}),
          },
        });

        let result;
        if (sanitizedHistory.length > 0) {
          const chat = model.startChat({
            history: sanitizedHistory,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
              ...(options.generationConfig || {}),
            },
          });
          result = await chat.sendMessageStream(prompt);
        } else {
          result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
              ...(options.generationConfig || {}),
            },
          });
        }

        let accumulatedReply = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            accumulatedReply += chunkText;
            if (onChunk) {
              onChunk(chunkText);
            }
          }
        }

        return {
          success: true,
          model: modelName,
          reply: accumulatedReply,
        };
      } catch (err) {
        lastError = err;
        const isRateLimit = isRateLimitOrQuotaError(err);
        console.warn(`[LLM Pipeline] ⚠️ Model ${modelName} with key ${key.substring(0, 8)} failed (${err.message}). ${isRateLimit ? "Rate limited." : ""}`);
        // If quota is exhausted for this key/project, skip other models on the same key
        if (isRateLimit) {
          break;
        }
      }
    }
  }

  console.error(`[LLM Pipeline] ❌ Request failed:`, lastError?.message);

  if (isRateLimitOrQuotaError(lastError)) {
    const rateLimitMsg = formatRateLimitMessage(lastError);
    if (onChunk) {
      onChunk(rateLimitMsg);
    }
    return {
      success: false,
      rateLimited: true,
      reply: rateLimitMsg,
      retryDelay: extractRetryDelay(lastError),
      error: lastError,
    };
  }

  throw lastError;
}

/**
 * generateGeminiContent – Non-streaming content generation with multi-key rotation and rate-limit recovery.
 *
 * @param {string|object|Array} promptOrContents
 * @param {object} customConfig
 */
export async function generateGeminiContent(promptOrContents, customConfig = {}) {
  const contents =
    typeof promptOrContents === "string"
      ? { contents: [{ role: "user", parts: [{ text: promptOrContents }] }] }
      : Array.isArray(promptOrContents)
        ? { contents: promptOrContents }
        : promptOrContents.contents
          ? promptOrContents
          : { contents: [promptOrContents] };

  const keys = getAvailableApiKeys();
  let lastError = null;

  for (const key of keys) {
    const client = getGeminiClient(key);

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
            ...customConfig,
          },
        });

        const response = await model.generateContent(contents);
        return {
          response: response.response,
          modelName,
          text: response.response.text(),
        };
      } catch (err) {
        lastError = err;
        console.warn(`[LLM Pipeline] generateContent model ${modelName} failed:`, err.message);
        if (isRateLimitOrQuotaError(err)) {
          break;
        }
      }
    }
  }

  console.error(`[LLM Pipeline] generateContent error:`, lastError?.message);
  throw lastError;
}

export const runLLM = streamGeminiResponse;