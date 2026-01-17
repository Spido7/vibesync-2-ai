# VibeSync AI 🎥✨

**VibeSync AI** is a professional-grade, local-first video captioning tool designed specifically for **Shorts, Reels, and TikTok**. It uses in-browser Artificial Intelligence to transcribe video audio and permanently "burn" high-energy, animated subtitles directly into the video file.

---

## 🚀 The "Local-First" Advantage
Unlike other editors, VibeSync AI runs **entirely on your device**.
* **Zero Server Costs:** The AI runs on the user's CPU/GPU. Hosting is free.
* **Total Privacy:** Videos are never uploaded to a cloud server.
* **Offline Capable:** Works without internet after the initial model download.

---

## ✨ Key Features (v2.0)

### 🤖 Dual AI Engines
* **English Fast:** Ultra-lightweight model for instant English transcription.
* **Multilingual:** Supports **100+ languages** (Spanish, French, Hindi, Chinese, etc.) with auto-detection.

### ⚡ Viral Caption Logic
* **Smart Splitting:** Automatically breaks long sentences into snappy **2-second chunks** perfect for high-retention vertical video.
* **Word-Level Precision:** AI aligns text perfectly with speech.

### 🎨 Professional Style Editor
* **Custom Fonts:** Choose from Sans, Serif, Mono, Handwriting, and Impact.
* **Visual Effects:** Add **Neon Glow**, **Box Backgrounds**, or Classic Outlines.
* **Layout Control:** Adjust vertical position and text size in real-time.

### 🎬 High-Res Export
* **Native MP4 Support:** Uses modern `VideoEncoder` & `mp4-muxer` to export **4K-ready MP4s** without heavy external libraries like FFmpeg.
* **Instant WebM:** Optional ultra-fast WebM export.

### 💰 Monetization Ready
* **Ad Banner Slots:** Pre-configured spaces to insert Google AdSense or sponsor banners.

---

## 🛠️ Tech Stack
* **Framework:** React.js + Vite
* **AI Inference:** `@xenova/transformers` (Whisper Tiny)
* **Video Processing:** Native WebCodecs API + `mp4-muxer`
* **Styling:** Pure CSS + HTML5 Canvas
* **Icons:** Lucide React

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
    *(Note: This installs `mp4-muxer` and `transformers.js`)*

3.  **Run Locally:**
    ```bash
    npm run dev
    ```

---

## 🌍 Cloudflare Pages Deployment

This project is optimized for Cloudflare Pages.

1.  **Connect GitHub:** Select your repo in the Cloudflare Dashboard.
2.  **Build Settings:**
    * **Framework Preset:** Vite
    * **Build Command:** `npm run build`
    * **Output Directory:** `dist`
3.  **Environment Variables:**
    * Add `NODE_VERSION` = `20` (Required for modern build tools).
4.  **Deploy:** Click Save & Deploy.

---

## ⚡ Important Notes
* **First Run:** The app requires an internet connection the very first time you use a model to download it to the browser cache (~40MB for English, ~150MB for Multilingual).
* **Browser Support:** Requires a modern browser (Chrome, Edge, Firefox, Brave) with `VideoEncoder` support.

---

## 📝 License
MIT License - Open Source & Free to Use.