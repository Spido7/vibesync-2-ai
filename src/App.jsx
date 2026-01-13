import React, { useState, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { pipeline, env } from '@xenova/transformers'; 
import ReactPlayer from 'react-player';
import './App.css';

// ✨ AI CONFIG: Prevents HTML/JSON parsing errors and forces remote model fetch
env.allowLocalModels = false;
env.useBrowserCache = true;

function App() {
  const [ffmpeg, setFfmpeg] = useState(null);
  const [transcriber, setTranscriber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState('');
  const [words, setWords] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [burning, setBurning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await loadFFmpeg();
    await loadWhisper();
  };

  const loadFFmpeg = async () => {
    try {
      setLoadingMessage('Loading FFmpeg (Video Processor)...');
      const ffmpegInstance = new FFmpeg();
      // Using your local files for better stability
      await ffmpegInstance.load({
        coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
        workerURL: await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript'),
      });
      
      setFfmpeg(ffmpegInstance);
      setLoadingProgress(50);
    } catch (error) {
      console.error('FFmpeg error:', error);
      alert('Failed to load Video Engine. Check setupProxy.js headers.');
    }
  };

  const loadWhisper = async () => {
    try {
      setLoadingMessage('Initializing AI engine...');
      setLoadingProgress(60);
      
      // Using the direct pipeline import from your package.json
      const transcribe = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          quantized: true,
          progress_callback: (data) => {
            if (data.status === 'progress') {
              const percent = Math.round(data.progress || 0);
              setLoadingMessage(`Downloading AI: ${percent}%`);
              setLoadingProgress(60 + (percent * 0.4));
            }
          }
        }
      );

      setTranscriber(() => transcribe);
      setLoadingProgress(100);
      setTimeout(() => setLoading(false), 500);
    } catch (error) {
      console.error('Whisper loading error:', error);
      setLoadingMessage('AI initialization failed.');
      setLoading(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB');
      return;
    }
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setWords([]);
    if (transcriber) setTimeout(() => processVideo(file), 500);
  };

  const processVideo = async (file) => {
    if (!ffmpeg || !transcriber) return;

    setProcessing(true);
    setTranscribing(true);
    setTranscriptionProgress('Step 1/3: Extracting audio...');

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      // Extract 16kHz mono WAV (Best for AI)
      await ffmpeg.exec(['-i', 'input.mp4', '-ar', '16000', '-ac', '1', 'audio.wav']);

      setTranscriptionProgress('Step 2/3: Reading audio data...');
      const audioData = await ffmpeg.readFile('audio.wav');
      const audioBlob = new Blob([audioData.buffer], { type: 'audio/wav' });
      
      setTranscriptionProgress('Step 3/3: AI Transcribing...');
      
      // v2.17 handles Blobs directly—no need for AudioContext
      const result = await transcriber(audioBlob, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5
      });

      const processedWords = result.chunks.map((chunk, index) => ({
        text: chunk.text.trim(),
        start: chunk.timestamp[0] ?? 0,
        end: chunk.timestamp[1] ?? (chunk.timestamp[0] + 2),
        id: `word_${index}_${Date.now()}`
      }));

      setWords(processedWords);
      setTranscriptionProgress(`✓ Complete! ${processedWords.length} captions.`);
      
      setTimeout(() => {
        setTranscribing(false);
        setProcessing(false);
        setTranscriptionProgress('');
      }, 2000);

    } catch (error) {
      console.error('Processing error:', error);
      alert('Transcription failed: ' + error.message);
      setProcessing(false);
      setTranscribing(false);
    }
  };

  const addManualCaption = () => {
    const newCaption = {
      text: 'New Caption',
      start: Math.floor(currentTime * 10) / 10,
      end: Math.floor((currentTime + 3) * 10) / 10,
      id: `manual_${Date.now()}`
    };
    setWords([...words, newCaption].sort((a, b) => a.start - b.start));
  };

  const handleWordEdit = (id, newText) => {
    setWords(words.map(w => w.id === id ? { ...w, text: newText } : w));
  };

  const handleTimeEdit = (id, field, value) => {
    const numValue = parseFloat(value) || 0;
    setWords(words.map(w => w.id === id ? { ...w, [field]: numValue } : w).sort((a, b) => a.start - b.start));
  };

  const deleteCaption = (id) => setWords(words.filter(w => w.id !== id));

  const getCurrentCaption = () => {
    const current = words.find(w => currentTime >= w.start && currentTime <= w.end);
    return current ? current.text : '';
  };

  const generateSRT = () => {
    return words.map((w, i) => {
      const format = (s) => {
        const d = new Date(s * 1000);
        return d.getUTCHours().toString().padStart(2,'0') + ":" + 
               d.getUTCMinutes().toString().padStart(2,'0') + ":" + 
               d.getUTCSeconds().toString().padStart(2,'0') + "," + 
               d.getUTCMilliseconds().toString().padStart(3,'0');
      };
      return `${i + 1}\n${format(w.start)} --> ${format(w.end)}\n${w.text}\n`;
    }).join('\n');
  };

  const downloadWithCaptions = async () => {
    if (!ffmpeg || words.length === 0) return;
    setBurning(true);
    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
      await ffmpeg.writeFile('subtitles.srt', new TextEncoder().encode(generateSRT()));
      
      // Burning command
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', `subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,BorderStyle=3'`,
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibesync-captioned.mp4`;
      a.click();
      setBurning(false);
    } catch (e) {
      alert("Burn error: " + e.message);
      setBurning(false);
    }
  };

  return (
    <div className="App">
      {loading && (
        <div className="loading-screen">
          <h2>VibeSync AI</h2>
          <p>{loadingMessage}</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${loadingProgress}%` }}></div></div>
        </div>
      )}

      <header className="hero">
        <h1>VibeSync AI</h1>
        <label className="upload-button">
          <input type="file" accept="video/*" onChange={handleVideoUpload} disabled={loading || processing} />
          {processing ? 'Processing...' : 'Upload Video'}
        </label>
      </header>

      {videoFile && (
        <div className="content">
          <div className="video-section">
            <ReactPlayer 
              ref={playerRef} 
              url={videoURL} 
              controls 
              playing={isPlaying} 
              width="100%" 
              onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
            />
            {getCurrentCaption() && <div className="caption-overlay">{getCurrentCaption()}</div>}
            
            <button className="add-caption-button" onClick={addManualCaption}>+ Add Manual Caption</button>
            <button className="download-button" onClick={downloadWithCaptions} disabled={burning}>
              {burning ? 'Burning...' : '🔥 Burn Captions'}
            </button>
          </div>

          <div className="transcript-section">
            <h2>AI Transcript ({words.length})</h2>
            <div className="transcript-list">
              {words.map((word) => (
                <div key={word.id} className="transcript-item">
                  <input type="number" step="0.1" value={word.start.toFixed(1)} onChange={(e) => handleTimeEdit(word.id, 'start', e.target.value)} />
                  <input type="text" value={word.text} onChange={(e) => handleWordEdit(word.id, e.target.value)} />
                  <button onClick={() => deleteCaption(word.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;