import React, { useState, useEffect, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { pipeline, env } from '@xenova/transformers'; // Uses the npm package
import ReactPlayer from 'react-player';
import './App.css';

// ✨ AI CONFIG: Prevents the HTML/JSON parsing error
env.allowLocalModels = false;
env.useBrowserCache = true;

// Load transformers from CDN via script tag approach
let TransformersLib = null;


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
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setFfmpeg(ffmpegInstance);
      setLoadingProgress(50);
    } catch (error) {
      console.error('FFmpeg error:', error);
      alert('Failed to load FFmpeg. Please refresh the page.');
    }
  };

  const loadWhisper = async () => {
    try {
      setLoadingMessage('Loading Transformers.js library...');
      setLoadingProgress(10);
      
      // Load transformers.js from CDN using script tag
      const loadScript = () => {
        return new Promise((resolve, reject) => {
          if (window.transformers) {
            console.log('Transformers already loaded');
            resolve(window.transformers);
            return;
          }

          const script = document.createElement('script');
          script.type = 'module';
          script.innerHTML = `
            import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js';
            
            env.allowLocalModels = false;
            env.allowRemoteModels = true;
            env.backends.onnx.wasm.numThreads = 1;
            
            window.transformers = { pipeline, env };
            window.dispatchEvent(new Event('transformers-loaded'));
          `;
          
          document.head.appendChild(script);
          
          const timeout = setTimeout(() => {
            reject(new Error('Script load timeout'));
          }, 30000);
          
          window.addEventListener('transformers-loaded', () => {
            clearTimeout(timeout);
            console.log('Transformers loaded from CDN');
            resolve(window.transformers);
          }, { once: true });
          
          script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load transformers script'));
          };
        });
      };

      setLoadingMessage('Initializing AI engine...');
      setLoadingProgress(20);
      
      TransformersLib = await loadScript();
      
      setLoadingMessage('Downloading Whisper model (~40MB, one-time download)...');
      setLoadingProgress(30);
      console.log('Creating Whisper pipeline...');
      
      const transcribe = await TransformersLib.pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          quantized: true,
          progress_callback: (data) => {
            console.log('Model download progress:', data);
            
            if (data.status === 'progress') {
              const percent = Math.round(data.progress || 0);
              const fileName = data.file || 'model';
              setLoadingMessage(`Downloading ${fileName}: ${percent}%`);
              setLoadingProgress(30 + (percent * 0.65));
            } else if (data.status === 'done') {
              setLoadingMessage('Model downloaded, initializing...');
              setLoadingProgress(95);
            } else if (data.status === 'ready') {
              setLoadingMessage('Whisper AI ready!');
              setLoadingProgress(100);
            }
          }
        }
      );

      console.log('Whisper pipeline created successfully');
      setTranscriber(transcribe);
      setLoadingProgress(100);
      
      setTimeout(() => {
        setLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('Whisper loading error:', error);
      setLoadingMessage('AI not available. Manual mode only.');
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
    
    if (transcriber) {
      setTimeout(() => processVideo(file), 500);
    }
  };

  const processVideo = async (file) => {
    if (!ffmpeg) {
      alert('FFmpeg not ready. Please wait for initialization.');
      return;
    }
    
    if (!transcriber) {
      alert('Whisper AI not loaded. Add captions manually.');
      return;
    }

    setProcessing(true);
    setTranscribing(true);
    setTranscriptionProgress('Step 1/5: Preparing video...');

    try {
      console.log('Writing video file to FFmpeg...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));

      setTranscriptionProgress('Step 2/5: Extracting audio (16kHz WAV)...');
      console.log('Extracting audio...');
      
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        'audio.wav'
      ]);

      setTranscriptionProgress('Step 3/5: Loading audio into memory...');
      console.log('Reading audio file...');
      
      const audioData = await ffmpeg.readFile('audio.wav');
      console.log('Audio data size:', audioData.length, 'bytes');
      
      const audioBlob = new Blob([audioData.buffer], { type: 'audio/wav' });
      console.log('Audio blob created, size:', audioBlob.size);
      
      setTranscriptionProgress('Step 4/5: Decoding audio...');
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio decoded:', audioBuffer.duration, 'seconds');
      
      const audioSamples = audioBuffer.getChannelData(0);
      console.log('Audio samples:', audioSamples.length, 'samples');
      
      setTranscriptionProgress('Step 5/5: AI Transcribing (may take 2-5 min)...');
      console.log('Starting Whisper transcription with', audioSamples.length, 'samples');
      
      const result = await transcriber(audioSamples, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5
      });

      console.log('Transcription complete:', result);

      const processedWords = [];
      
      if (result.chunks && Array.isArray(result.chunks)) {
        console.log(`Processing ${result.chunks.length} chunks`);
        
        result.chunks.forEach((chunk, index) => {
          if (chunk.timestamp && Array.isArray(chunk.timestamp)) {
            const start = chunk.timestamp[0] !== null ? chunk.timestamp[0] : 0;
            const end = chunk.timestamp[1] !== null ? chunk.timestamp[1] : start + 2;
            
            if (chunk.text && chunk.text.trim()) {
              processedWords.push({
                text: chunk.text.trim(),
                start: start,
                end: end,
                id: `word_${index}_${Date.now()}`
              });
            }
          }
        });
      } else if (result.text) {
        console.log('Using fallback: single caption');
        processedWords.push({
          text: result.text,
          start: 0,
          end: audioBuffer.duration,
          id: `word_0_${Date.now()}`
        });
      }

      console.log(`Generated ${processedWords.length} captions`);
      setWords(processedWords);
      setTranscriptionProgress(`✓ Complete! Generated ${processedWords.length} captions.`);
      
      await audioContext.close();
      
      setTimeout(() => {
        setTranscribing(false);
        setProcessing(false);
        setTranscriptionProgress('');
      }, 3000);

    } catch (error) {
      console.error('Processing error:', error);
      alert('Transcription failed: ' + error.message);
      setProcessing(false);
      setTranscribing(false);
      setTranscriptionProgress('');
    }
  };

  const addManualCaption = () => {
    const newCaption = {
      text: 'Enter your caption here',
      start: Math.floor(currentTime * 10) / 10,
      end: Math.floor((currentTime + 3) * 10) / 10,
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

  const deleteCaption = (id) => {
    setWords(words.filter(w => w.id !== id));
  };

  const duplicateCaption = (id) => {
    const caption = words.find(w => w.id === id);
    if (caption) {
      const newCaption = {
        ...caption,
        start: caption.end,
        end: caption.end + (caption.end - caption.start),
        id: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      setWords([...words, newCaption].sort((a, b) => a.start - b.start));
    }
  };

  const getCurrentCaption = () => {
    const current = words.find(w => currentTime >= w.start && currentTime <= w.end);
    return current ? current.text : '';
  };

  const generateSRT = () => {
    let srt = '';
    words.forEach((word, index) => {
      const startTime = formatSRTTime(word.start);
      const endTime = formatSRTTime(word.end);
      srt += `${index + 1}\n${startTime} --> ${endTime}\n${word.text}\n\n`;
    });
    return srt;
  };

  const formatSRTTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const formatDisplayTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const testSRTGeneration = () => {
    if (words.length === 0) {
      console.log('No captions to test');
      return;
    }
    
    const srt = generateSRT();
    console.log('=== SRT TEST ===');
    console.log('Number of captions:', words.length);
    console.log('SRT content:');
    console.log(srt);
    console.log('=== END SRT ===');
    
    alert(`SRT generated successfully!\n\nCaptions: ${words.length}\nLength: ${srt.length} characters\n\nCheck console for full content.`);
  };

  const downloadWithCaptions = async () => {
    if (!ffmpeg || words.length === 0) {
      alert('Cannot burn captions: FFmpeg not ready or no captions available.');
      return;
    }

    if (!videoFile) {
      alert('No video file found. Please upload a video first.');
      return;
    }

    setBurning(true);

    try {
      console.log('Starting caption burning process...');
      console.log('Number of captions:', words.length);
      
      console.log('Writing video file to FFmpeg...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      console.log('Generating SRT file...');
      const srtContent = generateSRT();
      console.log('SRT content length:', srtContent.length);
      console.log('SRT preview:', srtContent.substring(0, 200));
      
      await ffmpeg.writeFile('subtitles.srt', new TextEncoder().encode(srtContent));

      try {
        console.log('Attempting to load custom font...');
        const fontResponse = await fetch('https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf');
        if (fontResponse.ok) {
          const fontData = await fontResponse.arrayBuffer();
          await ffmpeg.writeFile('Roboto-Bold.ttf', new Uint8Array(fontData));
          console.log('Custom font loaded successfully');
        }
      } catch (fontError) {
        console.warn('Could not load custom font, using system default:', fontError);
      }

      console.log('Burning subtitles into video...');
      const subtitleStyle = "FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=20,Alignment=2";
      
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', `subtitles=subtitles.srt:force_style='${subtitleStyle}'`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'copy',
        '-y',
        'output.mp4'
      ]);

      console.log('Caption burning complete, reading output...');
      
      const data = await ffmpeg.readFile('output.mp4');
      console.log('Output video size:', data.length, 'bytes');
      
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibesync-captioned-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      console.log('Download triggered successfully');
      setBurning(false);
      
      alert('Video with burned captions downloaded successfully!');
      
    } catch (error) {
      console.error('Burning error:', error);
      alert('Failed to burn captions: ' + error.message);
      setBurning(false);
    }
  };

  const downloadSRT = () => {
    if (words.length === 0) return;
    const srtContent = generateSRT();
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captions.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSRT = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const srtContent = event.target.result;
      const parsedWords = parseSRT(srtContent);
      setWords(parsedWords);
    };
    reader.readAsText(file);
  };

  const parseSRT = (srt) => {
    const parsed = [];
    const blocks = srt.trim().split('\n\n');

    blocks.forEach((block, blockIndex) => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (timeMatch) {
          const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
          const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
          const text = lines.slice(2).join(' ');
          
          parsed.push({
            text,
            start,
            end,
            id: `imported_${blockIndex}_${Date.now()}`
          });
        }
      }
    });

    return parsed.sort((a, b) => a.start - b.start);
  };

  return (
    <div className="App">
      {loading && (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="spinner"></div>
            <h2>VibeSync AI</h2>
            <p>{loadingMessage}</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${loadingProgress}%` }}></div>
            </div>
            <p className="progress-text">{loadingProgress}%</p>
          </div>
        </div>
      )}

      <header className="hero">
        <div className="hero-content">
          <h1 className="hero-title">VibeSync AI</h1>
          <p className="hero-subtitle">AI-Powered Video Captioning with Whisper</p>
          <p className="hero-description">
            Generate and burn captions into videos using Whisper AI. 
            Everything runs locally in your browser - no cloud, 100% private.
          </p>
          
          <label className="upload-button">
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleVideoUpload}
              disabled={loading || processing}
            />
            {processing ? 'Processing...' : 'Upload Video (Max 100MB)'}
          </label>
        </div>
      </header>

      {videoFile && (
        <div className="content">
          <div className="video-section">
            <h2>Live Preview</h2>
            <div className="video-container">
              <ReactPlayer
                ref={playerRef}
                url={videoURL}
                controls
                playing={isPlaying}
                width="100%"
                height="100%"
                onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {getCurrentCaption() && (
                <div className="caption-overlay">
                  {getCurrentCaption()}
                </div>
              )}
            </div>

            {transcribing && (
              <div className="transcribing-status">
                <div className="spinner-small"></div>
                <span>{transcriptionProgress}</span>
              </div>
            )}

            {!transcribing && (
              <div className="controls-section">
                <button 
                  className="add-caption-button" 
                  onClick={addManualCaption}
                >
                  + Add Caption at {formatDisplayTime(currentTime)}
                </button>

                <div className="file-controls">
                  <label className="import-srt-button">
                    <input 
                      type="file" 
                      accept=".srt" 
                      onChange={importSRT}
                    />
                    📥 Import SRT
                  </label>

                  {words.length > 0 && (
                    <>
                      <button 
                        className="export-srt-button" 
                        onClick={downloadSRT}
                      >
                        📄 Export SRT
                      </button>
                      <button 
                        className="test-srt-button" 
                        onClick={testSRTGeneration}
                        title="Test SRT generation (check console)"
                      >
                        🔍 Test SRT
                      </button>
                    </>
                  )}
                </div>

                {words.length > 0 && (
                  <button 
                    className="download-button" 
                    onClick={downloadWithCaptions}
                    disabled={burning}
                  >
                    {burning ? 'Burning Captions...' : '🔥 Burn Captions to Video'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="transcript-section">
            <h2>AI Transcript ({words.length} segments)</h2>
            {words.length === 0 && !transcribing ? (
              <div className="empty-state">
                <p>Waiting for transcription...</p>
                <p>Upload a video to start AI transcription, or add captions manually.</p>
              </div>
            ) : (
              <div className="transcript-list">
                {words.map((word) => (
                  <div key={word.id} className="transcript-item">
                    <div className="time-inputs">
                      <input
                        type="number"
                        step="0.1"
                        value={word.start.toFixed(1)}
                        onChange={(e) => handleTimeEdit(word.id, 'start', e.target.value)}
                        className="time-input"
                      />
                      <span className="time-separator">→</span>
                      <input
                        type="number"
                        step="0.1"
                        value={word.end.toFixed(1)}
                        onChange={(e) => handleTimeEdit(word.id, 'end', e.target.value)}
                        className="time-input"
                      />
                    </div>
                    <input
                      type="text"
                      value={word.text}
                      onChange={(e) => handleWordEdit(word.id, e.target.value)}
                      className="transcript-input"
                    />
                    <div className="caption-actions">
                      <button 
                        className="duplicate-caption-btn"
                        onClick={() => duplicateCaption(word.id)}
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button 
                        className="delete-caption-btn"
                        onClick={() => deleteCaption(word.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>Powered by Whisper AI & FFmpeg WebAssembly</p>
        <p>All processing happens locally in your browser - 100% private</p>
      </footer>
    </div>
  );
}

export default App;