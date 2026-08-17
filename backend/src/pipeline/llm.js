/**
 * src/pipeline/llm.js
 * LLM module – wraps OpenAI Chat Completions (streaming).
 *
 * Swap the underlying implementation here to switch to Gemini / Claude etc.
 */

const SYSTEM_PROMPT = `You are ApniAwaaz, an empathetic, expert AI Confidence Coach.
Your role is to help users improve their public speaking, personal confidence, and
communication skills. Listen carefully, offer thoughtful constructive feedback, and
encourage with actionable tips. Keep responses concise (2-4 sentences) for quick TTS.
Speak in a warm, supportive, motivating tone.`;

/**
 * runLLM – streams tokens from the LLM and returns the full reply.
 *
 * @param {import("openai").OpenAI} openaiClient
 * @param {Array<{role: string, content: string}>} history  conversation history
 * @param {(token: string) => void} onToken  callback for each streamed token
 * @returns {Promise<string>} full reply text
 */
export async function runLLM(openaiClient, history, onToken) {
  // Prepend system prompt if history is empty
  const messages =
    history.length === 0 || history[0].role !== "system"
      ? [{ role: "system", content: SYSTEM_PROMPT }, ...history]
      : history;

  const stream = await openaiClient.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages,
    stream: true,
    max_tokens: 250,
    temperature: 0.8,
  });

  let fullReply = "";
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    fullReply += token;
    if (token && onToken) onToken(token);
  }

  return fullReply;
}

/**
 * buildConfidenceAnalysis – request a structured confidence analysis from LLM.
 * Returns JSON: { score, strengths: [], improvements: [], tip: string }
 *
 * @param {import("openai").OpenAI} openaiClient
 * @param {string} transcript  full session transcript
 * @returns {Promise<object>}
 */
export async function buildConfidenceAnalysis(openaiClient, transcript) {
  const resp = await openaiClient.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this transcript for confidence indicators and return ONLY valid JSON:
${transcript}

JSON schema:
{
  "score": <number 1-10>,
  "strengths": [<string>, ...],
  "improvements": [<string>, ...],
  "tip": "<one actionable tip>"
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  return JSON.parse(resp.choices[0].message.content);
}
