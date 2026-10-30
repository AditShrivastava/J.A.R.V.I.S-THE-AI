# J.A.R.V.I.S. — Personal Intelligence System

A local, voice-first business strategy assistant with an animated amber wire-orb, Groq-powered business reasoning, optional ElevenLabs speech, an in-console command menu, and downloadable PDF strategy reports.

## Requirements

- Node.js 20 or newer
- A Groq API key
- Optional: an ElevenLabs API key and Voice ID for custom spoken responses

## Setup

1. Open this folder in VS Code.
2. Create a `.env` file in the project root. Use `.env.example` as a template.
3. Add your private credentials to `.env` (never paste them into frontend source files).
4. In the terminal, run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:5173`. The server health endpoint is `http://localhost:8787/api/health`.

Example `.env` values:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
PORT=8787
```

The Groq model must be active and available to your account. Keep the model ID that is currently working for you if it differs from the example. If you do not configure ElevenLabs, the frontend will fall back to browser speech synthesis.

## Features

- Cinematic black-and-amber interface with a continuously rotating wireframe sphere, central reactor glow, orbiting rings, and floating particles.
- Orb motion intensity changes for thinking, listening, and speaking states.
- One floating button opens the conversation console; business prompts are contained inside the console instead of surrounding the orb.
- Browser microphone support with editable default wake phrase `Hey Jarvis`. After activating the microphone, you can either say the wake phrase plus a command or speak a command directly. Edge recognition results are submitted to Groq instead of remaining only in the transcript. The microphone pauses during spoken responses to avoid transcribing J.A.R.V.I.S. itself.
- Groq chat API for customer-segment analysis and business strategy.
- Optional ElevenLabs text-to-speech using an existing Voice ID.
- When a report/PDF is requested, J.A.R.V.I.S. prepares a more evidence-conscious strategy document. PDF export formats Markdown headings, tables, bullet lists, alternating table rows, page headers/footers, and page numbering. The report prompt explicitly separates confirmed inputs, assumptions, and unknowns and tells the model not to fabricate market figures or sources.
- `/api/health` reports AI, voice, and PDF export configuration.

## Notes

The orb is rendered by a custom Canvas 2D wire-mesh animation so it does not need a separate 3D package. This is an original interface inspired by cinematic amber holographic-orb motifs and is not affiliated with Marvel or Disney. PDF export formats the response content supplied by the assistant; it does not independently verify business claims or browse for external evidence. Scores should be treated as provisional unless supported by validated data.
