# ApniAwaaz – Voice-to-Voice AI Confidence Coach

A real-time, voice-to-voice AI application that listens to you speak,
analyses your confidence, and responds with empathetic coaching – instantly.

---

## Architecture

```
Browser (Next.js)
  │
  ├── Web Audio API → PCM chunks (binary)
  │                      │
  │          WebSocket (Socket.io)
  │                      │
  └──────────────  Backend (Express)
                          │
              ┌───────────┼───────────────┐
              ▼           ▼               ▼
           Deepgram      OpenAI          OpenAI TTS
           (STT)         GPT-4o-mini     / ElevenLabs
           nova-2        (LLM coach)     (audio output)
```

## Quick Start

### Prerequisites
- Node.js ≥ 20
- API keys for Deepgram and OpenAI (see `.env.example`)

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in your API keys
npm install
npm run dev                   # runs on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # runs on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) and press the mic button.

---

## Directory Structure

```
apni-awaaz/
├── backend/
│   ├── src/
│   │   └── pipeline/
│   │       ├── index.js      # barrel export
│   │       ├── stt.js        # Deepgram (live + one-shot)
│   │       ├── llm.js        # OpenAI chat (streaming)
│   │       └── tts.js        # OpenAI / ElevenLabs TTS
│   ├── .env.example
│   ├── package.json
│   └── server.js             # Express + Socket.io entry
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── globals.css   # dark theme + glassmorphism
    │   │   ├── layout.tsx    # root layout + SEO meta
    │   │   └── page.tsx      # main page (full pipeline UI)
    │   ├── components/
    │   │   ├── AudioVisualizer.tsx   # neon-blue equalizer bars
    │   │   ├── CoachMessage.tsx      # AI reply card
    │   │   ├── ConfidenceScore.tsx   # animated score ring
    │   │   ├── StatusBadge.tsx       # header state pill
    │   │   └── TranscriptBubble.tsx  # user speech bubble
    │   └── hooks/
    │       ├── useAudioCapture.ts    # Web Audio API + PCM
    │       └── useSocket.ts          # Socket.io lifecycle
    ├── .env.local.example
    ├── next.config.mjs
    ├── postcss.config.js
    ├── tailwind.config.js    # dark-premium theme + neon glows
    └── tsconfig.json
```

## Socket.io Events

| Direction | Event | Payload |
|-----------|-------|---------|
| → server  | `start_listening` | – |
| → server  | `audio_chunk` | `ArrayBuffer` (PCM-16) |
| → server  | `stop_listening` | – |
| → server  | `text_message` | `{ text: string }` |
| ← client  | `listening_started` | – |
| ← client  | `transcript` | `{ transcript, isFinal }` |
| ← client  | `coach_thinking` | – |
| ← client  | `coach_token` | `{ token: string }` |
| ← client  | `coach_reply_complete` | `{ reply: string }` |
| ← client  | `tts_start` | – |
| ← client  | `tts_audio_chunk` | `Uint8Array` |
| ← client  | `tts_end` | – |
| ← client  | `error` | `{ source, message }` |

## Swapping AI Providers

| Component | Default | Alternative |
|-----------|---------|-------------|
| STT | Deepgram nova-2 | OpenAI Whisper |
| LLM | OpenAI GPT-4o-mini | Google Gemini via ADK |
| TTS | OpenAI nova voice | ElevenLabs (set `ELEVENLABS_API_KEY`) |

Set `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` in `backend/.env` to auto-switch TTS to ElevenLabs.
