import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export async function convertToMp4(webmBlob, onProgress) {
  // 1. Setup Decoder (Hidden Video Element)
  const videoUrl = URL.createObjectURL(webmBlob);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true; 

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = (e) => reject(new Error("Video load failed"));
  });

  const w = video.videoWidth;
  const h = video.videoHeight;
  const safeW = w % 2 === 0 ? w : w - 1;
  const safeH = h % 2 === 0 ? h : h - 1;
  const duration = video.duration;

  // 2. Audio Extraction
  let audioData = null;
  let hasAudio = false;
  try {
    const audioCtx = new AudioContext();
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioData = {
      buffer: audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels
    };
    hasAudio = true;
    await audioCtx.close();
  } catch (e) {
    console.log("No audio track found or decode failed.");
  }

  // 3. Setup Muxer (FIXED HERE)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: safeW, height: safeH },
    audio: hasAudio ? { codec: 'aac', sampleRate: audioData.sampleRate, numberOfChannels: audioData.numberOfChannels } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset', // <--- THIS FIXES THE ERROR
  });

  // 4. Video Encoder Setup
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e)
  });

  const config = {
    codec: 'avc1.420033', 
    width: safeW,
    height: safeH,
    bitrate: 4_000_000, 
    framerate: 30
  };

  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) config.codec = 'avc1.4d002a'; 

  videoEncoder.configure(config);

  // 5. Encode Loop
  let isEncoding = true;
  
  if (hasAudio) {
    await encodeAudioTrack(audioData, muxer);
  }

  await new Promise((resolve) => {
    let frameCount = 0;
    
    async function onFrame() {
      if (!isEncoding || videoEncoder.state === "closed") return;

      if (videoEncoder.encodeQueueSize > 5) {
        video.pause();
        await new Promise(r => setTimeout(r, 10));
        video.play();
      }

      const frame = new VideoFrame(video);
      const keyFrame = frameCount % 60 === 0;
      videoEncoder.encode(frame, { keyFrame });
      frame.close();
      frameCount++;

      const pct = Math.min(99, (video.currentTime / duration) * 100);
      if (onProgress) onProgress(Math.floor(pct));

      if (!video.ended && !video.paused) {
        video.requestVideoFrameCallback(onFrame);
      } else if (video.ended) {
        isEncoding = false;
        resolve();
      }
    }

    video.onended = () => { isEncoding = false; resolve(); };
    video.requestVideoFrameCallback(onFrame);
    video.play();
  });

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

// Audio Helper
async function encodeAudioTrack(audioInfo, muxer) {
  const { buffer, sampleRate, numberOfChannels } = audioInfo;
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => console.error(e)
  });

  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: sampleRate,
    numberOfChannels: numberOfChannels,
    bitrate: 128_000
  });

  const chunkSize = 4096;
  const length = buffer.length;
  const dest = new Float32Array(chunkSize * numberOfChannels);

  for (let i = 0; i < length; i += chunkSize) {
    const size = Math.min(chunkSize, length - i);
    const currentDest = (size === chunkSize) ? dest : new Float32Array(size * numberOfChannels);

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const chData = buffer.getChannelData(ch);
      currentDest.set(chData.subarray(i, i + size), ch * size);
    }

    const timestamp = Math.round((i / sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: size,
      numberOfChannels,
      timestamp,
      data: currentDest
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();
}