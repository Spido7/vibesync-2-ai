# VibeSync AI 🎥✨

**VibeSync AI** is a professional-grade, local-first video captioning tool. It uses Artificial Intelligence to transcribe your videos and burn high-energy animated subtitles directly into the file—all without ever leaving your browser.

---

## 🚀 The "Local-First" Advantage
Unlike other video editors, VibeSync AI runs **entirely on your device**.
* **Zero Server Costs:** Since the AI runs on your CPU/GPU, hosting is 100% free.
* **Total Privacy:** Your videos are never uploaded to a server. Your data stays yours.
* **No Latency:** No waiting for files to upload or download from a cloud. 

---

## ✨ Key Features
* **AI Transcription:** Powered by OpenAI's Whisper (Tiny.en) via `Transformers.js`.
* **Animated Captions:** Dynamic, high-impact subtitles that move with the "vibe."
* **WASM Rendering:** Professional video processing in-browser using `FFmpeg.wasm`.
* **Auto-Emoji:** Intelligent keyword detection to add relevant emojis to your text.
* **Theme Switcher:** Customize colors and styles to match your brand.
* **Mobile-Ready Sharing:** Integrated Web Share API for instant social posting.

---

## 🛠️ Tech Stack
-   **Framework:** React.js (v18)
-   **Animation:** Framer Motion
-   **AI Model:** Transformers.js (Whisper Tiny)
-   **Video Engine:** FFmpeg.wasm
-   **Hosting:** Cloudflare Pages (via GitHub)

---

## 📦 Installation & Setup

1.  **Clone the Repo:**
    ```bash
    git clone [https://github.com/Spido7/vibesync-ai.git](https://github.com/Spido7/vibesync-ai.git)
    cd vibesync-ai
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Run Locally:**
    ```bash
    npm start
    ```

---

## 🌍 Cloudflare Deployment Guide
This project is optimized for Cloudflare Pages.

1.  **Push to GitHub:** Ensure the `_headers` file is in your `public` folder.
2.  **Connect Cloudflare:** Connect your GitHub repo to Cloudflare Pages.
3.  **Build Settings:** * **Framework:** Create React App
    * **Build Command:** `npm run build`
    * **Output Directory:** `build`
4.  **Security:** Cloudflare will automatically detect the `_headers` file and enable `Cross-Origin-Embedder-Policy`, which is required for the video engine to work.

---

## ⚡ Performance Tip
VibeSync AI is a heavyweight tool running in a lightweight environment. For the fastest transcription and rendering speeds, **using a laptop or desktop computer is highly recommended.**

---

## 📝 License
MIT License - Created with ❤️ by Spido
