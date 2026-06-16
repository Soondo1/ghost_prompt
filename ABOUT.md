# Prompt Ghost 👻

**Real-time AI-powered ghost suggestions for LLM textareas.**

Prompt Ghost is a Chrome extension that supercharges your interactions with AI chatbots. As you type a rough idea into any supported LLM interface, Prompt Ghost silently calls a backend AI model to rewrite your prompt into a high-quality, token-efficient version — and displays the optimized text as a translucent "ghost" overlay right inside the textarea. Press **Tab** to accept the suggestion instantly.

Think of it as autocomplete, but for *better prompts*.

---

## Why Prompt Ghost Exists

Most people interact with large language models by typing whatever comes to mind. The quality of the response, however, is deeply tied to the quality of the prompt. Prompt engineering is a skill — and Prompt Ghost automates it in real time so that **anyone** can get expert-level outputs from ChatGPT, Claude, Gemini, and other AI tools without learning prompting techniques.

### The Problem

- Users write vague, under-specified prompts → LLMs produce generic, unhelpful answers.
- Learning prompt engineering frameworks (like PECRA) takes time most users won't invest.
- Copy-pasting into a separate "prompt optimizer" tool breaks the creative flow.

### The Solution

Prompt Ghost lives *inside* the AI chat interface itself. It watches what you type, sends your rough intent to a Gemini 2.5 Flash backend, and displays an optimized version as a ghost overlay — all without leaving the page. One **Tab** press and the optimized prompt replaces your draft.

---

## Features

### 🔮 Live Ghost Overlay (Content Script)
- Detects `<textarea>` and `contenteditable` elements on supported AI chat sites.
- After an 800ms debounce, sends your draft to the backend for optimization.
- Renders the AI-optimized prompt as a semi-transparent overlay aligned pixel-perfectly on top of the original input field.
- Press **Tab** to accept the suggestion; any other keystroke dismisses it.
- Handles scroll offsets, element resizing, and race conditions gracefully.

### ✨ Manual Transform (Popup UI)
- Click the extension icon to open a popup with a manual prompt input box.
- Paste or type any rough idea and hit **Transform Text**.
- Receive **two** distinct optimized variations:
  - **Option 1 — Concise**: A direct, token-efficient rewrite.
  - **Option 2 — Detailed**: A comprehensive, context-rich rewrite.
- One-click copy to clipboard for each variation.

### ⚙️ User Settings
- **Enable / Disable** the live ghost overlay without uninstalling the extension.
- **Optimization Level** toggle: choose between `Concise` and `Detailed` styles for the live overlay suggestions.
- Settings persist via `chrome.storage.sync`, syncing across devices.

---

## Supported AI Platforms

Prompt Ghost injects its content script into the following sites:

| Platform | URL Pattern |
|---|---|
| ChatGPT | `chat.openai.com`, `chatgpt.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| Perplexity | `*.perplexity.ai` |
| DeepSeek | `*.deepseek.com` |
| Poe | `poe.com` |
| Microsoft Copilot | `copilot.microsoft.com` |
| HuggingChat | `huggingface.co/chat` |
| Meta AI | `www.meta.ai` |

---

## Architecture

The project has three main layers:

```
┌─────────────────────────────────────────────────┐
│              Chrome Extension                    │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐ │
│  │  Popup UI    │    │  Content Script         │ │
│  │  (React)     │    │  (Vanilla JS, IIFE)     │ │
│  │              │    │                          │ │
│  │  Manual      │    │  Live ghost overlay      │ │
│  │  Transform   │    │  Tab-to-accept           │ │
│  └──────┬───────┘    └───────────┬──────────────┘ │
│         │                        │                │
│         └──────┬─────────────────┘                │
│                │  chrome.runtime messages          │
│         ┌──────▼───────┐                          │
│         │  Background  │                          │
│         │  Service     │                          │
│         │  Worker      │                          │
│         └──────┬───────┘                          │
└────────────────┼────────────────────────────────┘
                 │  HTTP POST
                 ▼
┌────────────────────────────────────────┐
│      Backend API (Vercel / Express)    │
│                                        │
│  POST /optimize  — single suggestion   │
│  POST /transform — two variations      │
│                                        │
│  Powered by Gemini 2.5 Flash           │
│  (via @google/generative-ai SDK)       │
└────────────────────────────────────────┘
```

### Content Script (`src/content.js`)
- Self-contained IIFE injected into every supported site at `document_idle`.
- Listens for `input` events on textareas and contenteditable elements.
- Debounces input (800ms), then sends the draft to the background service worker.
- Creates an absolutely-positioned `<div>` overlay matching the target element's font, padding, and position.
- Handles `Tab` key interception to apply the suggestion (using `execCommand('insertText')` for contenteditable and native value setter for textareas to trigger React/framework change detection).

### Background Service Worker (`src/background.js`)
- Manifest V3 service worker.
- Relays messages between the content script / popup and the remote API.
- Calls `POST /optimize` for live overlay suggestions.
- Calls `POST /transform` for the popup's manual two-variation mode.

### Popup UI (`popup/`)
- Built with **React 18** and styled with **Tailwind CSS**.
- Bundled by **Vite** into `dist/popup/`.
- Provides a manual prompt transformation interface and extension settings controls.

### Backend Server (`server/server.js`)
- **Express.js** server deployed on **Vercel** (serverless).
- Two endpoints:
  - `POST /optimize` — Takes a prompt and optimization level, returns a single PECRA-formatted optimized prompt.
  - `POST /transform` — Takes a prompt, returns a JSON array of two variations (concise + detailed).
- Uses the **Google Generative AI SDK** (`@google/generative-ai`) to call **Gemini 2.5 Flash**.
- API key stored in environment variable `GEMINI_API_KEY`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension manifest | Chrome Manifest V3 |
| Content script | Vanilla JavaScript (IIFE) |
| Popup UI | React 18 + Tailwind CSS |
| Build tool | Vite 5 |
| Backend | Express.js on Vercel (serverless) |
| AI model | Google Gemini 2.5 Flash |
| AI SDK | `@google/generative-ai` |

---

## Project Structure

```
masterprompt/
├── manifest.json          # Chrome extension manifest (MV3)
├── package.json           # Dependencies & scripts
├── vite.config.js         # Vite build config (popup → dist/popup)
├── vercel.json            # Vercel serverless deployment config
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── .env                   # Environment variables (GEMINI_API_KEY)
├── src/
│   ├── background.js      # MV3 service worker (message relay)
│   └── content.js         # Content script (ghost overlay logic)
├── popup/
│   ├── index.html         # Popup HTML entry point
│   └── src/
│       ├── App.jsx        # React popup component
│       ├── index.jsx      # React entry point
│       └── index.css      # Popup styles
├── server/
│   └── server.js          # Express API (Gemini integration)
└── dist/                  # Built popup output (gitignored)
```

---

## How It Works — End to End

1. **User types** a rough prompt into ChatGPT (or any supported site).
2. **Content script** detects input, waits 800ms for the user to pause.
3. Content script sends a `fetchSuggestion` message to the **background service worker**.
4. Background worker sends an HTTP `POST /optimize` request to the **Vercel-hosted API**.
5. The server constructs a system instruction telling Gemini to act as a prompt optimizer, appends the user's draft, and calls **Gemini 2.5 Flash**.
6. Gemini returns an optimized prompt; the server sends it back as JSON.
7. The background worker relays the response to the content script.
8. Content script renders the optimized text as a **ghost overlay** (translucent text positioned over the textarea).
9. **User presses Tab** → the suggestion replaces their draft. Any other key dismisses the ghost.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key for Gemini

### Installation

```bash
# Clone the repo
git clone https://github.com/Soondo1/ghost_prompt.git
cd ghost_prompt

# Install dependencies
npm install

# Create your .env file
echo "GEMINI_API_KEY=your_key_here" > .env
```

### Development

```bash
# Build the popup UI
npm run build

# Start the local API server (optional, for local testing)
npm run server
```

### Load into Chrome

1. Navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the project root directory.
4. The Prompt Ghost extension icon should appear in your toolbar.

### Deployment

The backend API is deployed to **Vercel** using the configuration in `vercel.json`. Push to the connected repository to trigger automatic deployment.

---

## License

This project is maintained by [Soondo1](https://github.com/Soondo1).
