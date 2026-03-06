# Research Paper Summarizer

A Chrome Extension that automatically extracts and summarizes abstracts from research paper pages using AI.

## What It Does

When you visit a research article page, the extension extracts the abstract and sends it to an AI model (Llama 3 via Groq) which returns a structured summary with:

- **Main Idea** — one sentence describing the research goal
- **Key Contributions** — bullet points of the main findings
- **Methods** — how the research was conducted

## Supported Websites

- Google Scholar
- IEEE Xplore
- ACM Digital Library
- arXiv
- PubMed
- Springer / Nature / Elsevier
- General journal/article pages

## Installation

### Prerequisites

- Google Chrome browser
- A free [Groq API key](https://console.groq.com/keys) (no credit card required)

### Steps

1. Clone or download this repository
   ```bash
   git clone https://github.com/KhianBrian/research-paper-summarizer.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the `research-paper-summarizer` folder

5. Click the extension icon in the toolbar (pin it via the 🧩 puzzle icon if needed)

6. Click ⚙ **Settings** → paste your Groq API key → **Save**

## Usage

1. Open any research paper page
2. Click the extension icon
3. Press **Generate Summary**
4. View the structured summary in the popup
5. Use **Save** to keep it in history, or **Copy** to copy it as plain text

## Project Structure

```
research-paper-summarizer/
├── manifest.json      Extension metadata and permissions (Manifest V3)
├── content.js         Extracts abstract text from the webpage DOM
├── background.js      Service worker — handles Groq API communication
├── popup.html         Popup UI (Main / Settings / History views)
├── popup.css          Dark-themed styles
├── popup.js           Popup controller logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. User clicks **Generate Summary** in the popup
2. `popup.js` sends a message to `content.js` running in the active tab
3. `content.js` scans the page using ~25 CSS selectors targeting known abstract containers, with fallbacks for generic pages
4. The extracted text is passed to `background.js`
5. `background.js` sends it to the [Groq API](https://groq.com) (Llama 3.1 8B model)
6. The API returns a structured JSON summary
7. The popup renders the result

## Privacy

- Your API key is stored locally in Chrome (`chrome.storage.sync`) and is never sent anywhere except directly to the Groq API
- Summaries are stored locally in `chrome.storage.local`
- No data is collected or transmitted to any third party

## API

This extension uses the [Groq API](https://console.groq.com) with the `llama-3.1-8b-instant` model. Groq offers a free tier with:
- 14,400 requests/day
- 30 requests/minute

No credit card is required to sign up.

## License

MIT
