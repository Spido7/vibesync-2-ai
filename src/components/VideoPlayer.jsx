import React from 'react';
import { Download } from 'lucide-react';

const VideoPlayer = ({ videoUrl }) => {
  if (!videoUrl) return null;

  return (
    <div className="result-area">
      <h3>🎉 Your VibeSync Video</h3>
      <video src={videoUrl} controls className="preview-video" />
      <a href={videoUrl} download="VibeSync_Captioned.webm" className="btn-download">
        <Download size={18} /> Download Video
      </a>
    </div>
  );
};

export default VideoPlayer;