import React, { useState, useRef } from 'react';
import { pipeline, env } from '@xenova/transformers';
import { Upload, Wand2, Play, Loader2 } from 'lucide-react';
import CaptionEditor from './components/CaptionEditor';
import VideoPlayer from './components/VideoPlayer';
import { extractAudio } from './utils';
import './App.css';

// Skip local checks to avoid Vite 404 errors
env.allowLocalModels = false;
env.useBrowserCache = false;

function App() {
  const [file, setFile] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleTranscribe = async () => {
    if (!file) return;
    setStatus('transcribing');
    
    try {
      const audioData = await extractAudio(file);
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
      
      const result = await transcriber(audioData, { 
        chunk_length_s: 30, 
        stride_length_s: 5,
        return_timestamps: true 
      });

      const formatted = result.chunks.map(chunk => ({
        text: chunk.text,
        start: chunk.timestamp[0],
        end: chunk.timestamp[1] || chunk.timestamp[0] + 2
      }));

      setCaptions(formatted);
      setStatus('ready_to_burn');
    } catch (e) {
      console.error(e);
      setStatus('idle');
      alert(e.message);
    }
  };

  const handleBurn = async () => {
    setStatus('burning');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 1. Prepare Video Source
    video.src = URL.createObjectURL(file);
    await new Promise(r => video.onloadeddata = r);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 2. Create Streams (Visual + Audio)
    const stream = canvas.captureStream(30); // 30 FPS visual stream
    
    // ★ CRITICAL FIX: Add Audio Track ★
    // Capture the stream from the source video element to get the audio
    const audioStream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    const audioTrack = audioStream.getAudioTracks()[0];
    
    if (audioTrack) {
      stream.addTrack(audioTrack); // Add source audio to the canvas recording
    } else {
      console.warn("No audio track found in source video");
    }

    // 3. Setup Recorder with Audio Codec (Opus)
    const recorder = new MediaRecorder(stream, { 
      mimeType: 'video/webm; codecs=vp9,opus' 
    });
    
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setOutputUrl(URL.createObjectURL(blob));
      setStatus('completed');
    };

    recorder.start();
    video.currentTime = 0;
    
    // Must play AFTER starting recorder to ensure audio is captured
    await video.play();

    const draw = () => {
      if (video.paused || video.ended) {
        recorder.stop();
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const active = captions.find(c => video.currentTime >= c.start && video.currentTime <= c.end);
      if (active) {
        const fontSize = canvas.height * 0.05;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'black';
        ctx.strokeText(active.text.trim(), canvas.width / 2, canvas.height - 50);
        ctx.fillStyle = 'white';
        ctx.fillText(active.text.trim(), canvas.width / 2, canvas.height - 50);
      }

      setProgress(Math.floor((video.currentTime / video.duration) * 100));
      requestAnimationFrame(draw);
    };
    draw();
  };

  const reset = () => {
    setFile(null);
    setCaptions([]);
    setStatus('idle');
    setOutputUrl(null);
  };

  return (
    <div className="app">
      <header>
        <h1>VibeSync AI</h1>
        <p>Client-Side Video Captioning</p>
      </header>

      <main className="main-card">
        {/* Hidden Elements */}
        <video ref={videoRef} className="hidden" muted={false} playsInline crossOrigin="anonymous" style={{display:'none'}} />
        <canvas ref={canvasRef} className="hidden" style={{display:'none'}} />

        {!file ? (
          <label className="upload-box">
            <Upload size={40} style={{ marginBottom: 10, color: '#a1a1aa' }} />
            <div>Click to Select Video</div>
            <input type="file" onChange={e => setFile(e.target.files[0])} accept="video/*" hidden />
          </label>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <strong>{file.name}</strong>
              <button onClick={reset} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Reset</button>
            </div>

            {status === 'idle' && (
              <button className="btn" onClick={handleTranscribe}>
                <Wand2 size={18} /> Generate Captions (AI)
              </button>
            )}

            {status === 'ready_to_burn' && (
              <>
                <CaptionEditor captions={captions} setCaptions={setCaptions} />
                <button className="btn" onClick={handleBurn}>
                  <Play size={18} /> Burn Captions & Export
                </button>
              </>
            )}

            {status === 'transcribing' && (
               <div className="status-bar">
                 <Loader2 className="spinner" size={24} style={{display:'inline', animation:'spin 1s infinite linear'}}/> 
                 <span style={{marginLeft: 10}}>Downloading AI Model...</span>
               </div>
            )}
            
            {status === 'burning' && <div className="status-bar">Rendering Video: {progress}%</div>}

            {status === 'completed' && <VideoPlayer videoUrl={outputUrl} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;