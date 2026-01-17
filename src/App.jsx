import React, { useState, useRef, useEffect } from 'react';
import { pipeline, env } from '@xenova/transformers';
import { Upload, Wand2, Play, Loader2, X, Download, Settings, Type, Palette, Layout, Scaling, Megaphone, FileVideo } from 'lucide-react';
import CaptionEditor from './components/CaptionEditor';
import { extractAudio } from './utils';
import { convertToMp4 } from './mp4Encoder'; // <--- IMPORT THE NEW FILE
import './App.css';

// ... (Keep existing Global Configuration) ...
env.allowLocalModels = false;
env.useBrowserCache = false;
env.remoteHost = 'https://huggingface.co';
env.remotePathComponent = 'models';

// ... (Keep AdBanner Component) ...
const AdBanner = () => (
  <div className="ad-section">
    <div className="ad-label">Sponsored</div>
    <div className="ad-placeholder">
      <Megaphone size={20} style={{ opacity: 0.5, marginBottom: '8px' }} />
      <span>Ad Banner Space (728x90)</span>
    </div>
  </div>
);

function App() {
  // ... (Keep existing states) ...
  const [file, setFile] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [status, setStatus] = useState('idle'); 
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState(null);
  const [message, setMessage] = useState(null);
  
  // NEW STATE FOR MP4 CONVERSION
  const [mp4Status, setMp4Status] = useState('idle'); // idle, converting, done
  const [mp4Url, setMp4Url] = useState(null);
  const [webmBlob, setWebmBlob] = useState(null); // Store blob for conversion

  // ... (Keep Style Settings & Refs) ...
  const [styleSettings, setStyleSettings] = useState({
    font: 'sans-serif',
    fontSize: 5,
    color: '#ffffff',
    position: 80, 
    effect: 'classic'
  });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

  // ... (Keep processChunks logic) ...
  const processChunks = (chunks) => { /* ... existing logic ... */ 
      const processed = [];
      chunks.forEach(chunk => {
        const text = chunk.text.trim();
        const start = chunk.timestamp[0];
        const end = chunk.timestamp[1] || start + 2;
        const duration = end - start;
        const words = text.split(/\s+/);

        if (duration > 2 && words.length > 4) {
            const wordsPerChunk = 5; 
            const numberOfSplits = Math.ceil(words.length / wordsPerChunk);
            const timePerSplit = duration / numberOfSplits;
            for (let i = 0; i < numberOfSplits; i++) {
            const chunkWords = words.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk);
            processed.push({
                text: chunkWords.join(' '),
                start: start + (i * timePerSplit),
                end: start + ((i + 1) * timePerSplit)
            });
            }
        } else {
            processed.push({ text, start, end });
        }
      });
      return processed;
  };
  
  // ... (Keep notify & reset) ...
  const notify = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const reset = () => {
    setFile(null);
    setCaptions([]);
    setStatus('idle');
    setOutputUrl(null);
    setMp4Status('idle'); // Reset MP4 status
    setMp4Url(null);
    setWebmBlob(null);
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
  };

  // ... (Keep drawFrame logic) ...
  const drawFrame = (video, canvas, ctx, currentCaptions, isPreview = false) => {
      // ... same logic as before ...
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentTime = video.currentTime;
    const active = currentCaptions.find(c => currentTime >= c.start && currentTime <= c.end);

    if (active) {
      const { text } = active;
      const { font, fontSize, color, position, effect } = styleSettings;
      
      const sizePx = (canvas.height * fontSize) / 100;
      const lineHeight = sizePx * 1.3;
      const yPos = (canvas.height * position) / 100;
      
      ctx.font = `bold ${sizePx}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxWidth = canvas.width * 0.85; 
      const words = text.trim().split(' ');
      let line = '';
      let lines = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      lines.forEach((l, i) => {
        const totalBlockHeight = lines.length * lineHeight;
        const lineY = (yPos - totalBlockHeight / 2) + (i * lineHeight) + (lineHeight/2);

        if (effect === 'box') {
          const metrics = ctx.measureText(l);
          const bgPadding = sizePx * 0.4;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(
            (canvas.width / 2) - (metrics.width / 2) - bgPadding, 
            lineY - (sizePx / 2) - (bgPadding/2), 
            metrics.width + (bgPadding * 2), 
            sizePx + bgPadding
          );
        } else if (effect === 'glow') {
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeText(l, canvas.width / 2, lineY);
          ctx.shadowBlur = 0;
        } else { 
          ctx.lineWidth = sizePx * 0.15;
          ctx.strokeStyle = 'black';
          ctx.strokeText(l, canvas.width / 2, lineY);
        }

        ctx.fillStyle = color;
        ctx.fillText(l, canvas.width / 2, lineY);
      });
    }

    if (isPreview && !video.paused && !video.ended) {
      animationFrameId.current = requestAnimationFrame(() => 
        drawFrame(video, canvas, ctx, currentCaptions, true)
      );
    }
  };

  // ... (Keep useEffect & handleTranscribe) ...
  useEffect(() => {
    if (status === 'ready_to_burn' && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      drawFrame(video, canvas, ctx, captions, false);
      const startLoop = () => drawFrame(video, canvas, ctx, captions, true);
      const stopLoop = () => cancelAnimationFrame(animationFrameId.current);
      video.addEventListener('play', startLoop);
      video.addEventListener('pause', stopLoop);
      video.addEventListener('seeked', () => drawFrame(video, canvas, ctx, captions, false));
      return () => {
        video.removeEventListener('play', startLoop);
        video.removeEventListener('pause', stopLoop);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      };
    }
  }, [status, styleSettings, captions]);

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus('transcribing');
    try {
      const audioData = await extractAudio(file);
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      const result = await transcriber(audioData, { chunk_length_s: 30, return_timestamps: true });
      const formatted = processChunks(result.chunks);
      setCaptions(formatted);
      notify("✨ Transcription Complete!");
      setStatus('ready_to_burn');
    } catch (e) {
      console.error(e);
      setStatus('idle');
      notify("❌ Error: " + e.message);
    }
  };

  const handleBurn = async () => {
    setStatus('burning');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const audioStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    if (audioStream.getAudioTracks().length) stream.addTrack(audioStream.getAudioTracks()[0]);

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setWebmBlob(blob); // Save for MP4 conversion
      setOutputUrl(url);
      setStatus('completed');
    };
    recorder.start();
    video.currentTime = 0;
    await video.play();

    const render = () => {
      if (video.paused || video.ended) {
        recorder.stop();
        return;
      }
      drawFrame(video, canvas, ctx, captions, false);
      const percent = Math.floor((video.currentTime / video.duration) * 100);
      setProgress(percent);
      requestAnimationFrame(render);
    };
    render();
  };

  // --- NEW: MP4 CONVERSION HANDLER ---
  const handleMp4Convert = async () => {
    if (!webmBlob) return;
    setMp4Status('converting');
    notify("⏳ Converting to MP4 (High Res)...");
    
    try {
      const mp4Blob = await convertToMp4(webmBlob, (pct) => {
         // You can add a specific progress bar for this if you want
         console.log('MP4 Progress:', pct); 
      });
      const url = URL.createObjectURL(mp4Blob);
      setMp4Url(url);
      setMp4Status('done');
      notify("✅ MP4 Ready!");
    } catch (e) {
      console.error(e);
      setMp4Status('idle');
      notify("❌ MP4 Failed: " + e.message);
    }
  };

  return (
    <div className="app">
      <header className="header-container">
        <h1>VibeSync AI</h1>
        <p>Shorts & Reels Caption Generator</p>
      </header>

      {message && <div className="notification">{message}</div>}

      <main className="main-card">
        <video ref={videoRef} className="hidden-source" muted={false} playsInline crossOrigin="anonymous" />

        {!file ? (
          <>
            <label className="upload-box">
              <Upload size={48} className="icon-accent" />
              <div>Upload Video (9:16 Ready)</div>
              <input type="file" onChange={e => {
                  setFile(e.target.files[0]);
                  if(videoRef.current) videoRef.current.src = URL.createObjectURL(e.target.files[0]);
              }} accept="video/*" hidden />
            </label>
            <AdBanner />
          </>
        ) : (
          <div className="process-area">
            {/* ... (Keep existing layout) ... */}
            <div className="file-row">
              <span className="file-name">{file.name}</span>
              <button className="btn-reset" onClick={reset}><X size={14}/> Reset</button>
            </div>

            {status === 'idle' && (
              <button className="btn-primary" onClick={handleTranscribe}>
                <Wand2 size={18} /> Generate Captions
              </button>
            )}

            {status === 'transcribing' && (
              <div className="loading-state">
                <Loader2 className="spinner" size={32} />
                <p>AI is splitting captions...</p>
              </div>
            )}

            {status === 'ready_to_burn' && (
               <div className="workspace-grid">
                 <div className="preview-container">
                    <canvas ref={canvasRef} className="live-canvas" />
                    <div className="canvas-controls">
                        <button onClick={() => videoRef.current.play()}><Play size={16}/></button>
                        <button onClick={() => videoRef.current.pause()}>||</button>
                        <input type="range" min="0" max="100" defaultValue="0"
                          onChange={(e) => {
                             const time = (videoRef.current.duration * e.target.value) / 100;
                             videoRef.current.currentTime = time;
                          }}
                        />
                    </div>
                </div>

                <div className="controls-panel">
                    <h3><Settings size={16}/> Style Editor</h3>
                    <div className="control-group">
                        <label><Scaling size={14}/> Text Size ({styleSettings.fontSize}%)</label>
                        <input type="range" min="2" max="10" step="0.5" value={styleSettings.fontSize} 
                          onChange={(e) => setStyleSettings({...styleSettings, fontSize: Number(e.target.value)})} />
                    </div>
                    <div className="control-group">
                        <label><Type size={14}/> Font</label>
                        <select value={styleSettings.font} onChange={e => setStyleSettings({...styleSettings, font: e.target.value})}>
                            <option value="sans-serif">Arial / Sans</option>
                            <option value="serif">Times / Serif</option>
                            <option value="monospace">Courier / Mono</option>
                            <option value="cursive">Comic / Hand</option>
                            <option value="fantasy">Impact / Bold</option>
                        </select>
                    </div>
                    <div className="control-group">
                        <label><Palette size={14}/> Color & Effect</label>
                        <div className="row-inputs">
                            <input type="color" value={styleSettings.color} onChange={e => setStyleSettings({...styleSettings, color: e.target.value})} />
                            <select value={styleSettings.effect} onChange={e => setStyleSettings({...styleSettings, effect: e.target.value})}>
                                <option value="classic">Classic</option>
                                <option value="box">Box</option>
                                <option value="glow">Neon</option>
                            </select>
                        </div>
                    </div>
                    <div className="control-group">
                        <label><Layout size={14}/> Vertical Position</label>
                        <div className="position-toggles">
                            <button className={styleSettings.position === 15 ? 'active' : ''} onClick={() => setStyleSettings({...styleSettings, position: 15})}>Top</button>
                            <button className={styleSettings.position === 50 ? 'active' : ''} onClick={() => setStyleSettings({...styleSettings, position: 50})}>Mid</button>
                            <button className={styleSettings.position === 80 ? 'active' : ''} onClick={() => setStyleSettings({...styleSettings, position: 80})}>Bot</button>
                        </div>
                    </div>
                    <div className="divider"></div>
                    <CaptionEditor captions={captions} setCaptions={setCaptions} />
                    <button className="btn-primary" onClick={handleBurn}>
                        <Download size={18} /> Burn Video
                    </button>
                    <AdBanner />
                </div>
               </div>
            )}

            {status === 'burning' && (
              <div className="loading-state">
                <div className="progress-bar"><div className="fill" style={{width: `${progress}%`}}></div></div>
                <p>Rendering Video: {progress}%</p>
              </div>
            )}

            {status === 'completed' && (
               <div className="result-area">
                  <div className="video-preview-wrapper">
                    <video src={outputUrl} controls className="final-video" />
                  </div>
                  
                  <div className="download-options">
                    {/* OPTION 1: DOWNLOAD WEBM */}
                    <a href={outputUrl} download="VibeSync_Export.webm" className="btn-download">
                      <Download size={18}/> Download WebM (Instant)
                    </a>
                    
                    {/* OPTION 2: CONVERT TO MP4 */}
                    {mp4Status === 'idle' && (
                        <button className="btn-download btn-secondary" onClick={handleMp4Convert}>
                            <FileVideo size={18}/> Convert to MP4 (High Res)
                        </button>
                    )}
                    
                    {mp4Status === 'converting' && (
                        <button className="btn-download btn-secondary" disabled>
                            <Loader2 className="spinner" size={18}/> Converting...
                        </button>
                    )}

                    {mp4Status === 'done' && (
                        <a href={mp4Url} download="VibeSync_Export.mp4" className="btn-download btn-success">
                            <Download size={18}/> Download MP4 Ready
                        </a>
                    )}
                  </div>
                  
                  <AdBanner />
               </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;