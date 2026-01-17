import React from 'react';
import { formatTime } from '../utils';

const CaptionEditor = ({ captions, setCaptions }) => {
  const handleEdit = (index, newText) => {
    const updated = [...captions];
    updated[index].text = newText;
    setCaptions(updated);
  };

  return (
    <div className="editor-container">
      <h3>📝 Edit Captions</h3>
      <div className="caption-list">
        {captions.map((cap, idx) => (
          <div key={idx} className="caption-item">
            <span className="timestamp">
              {formatTime(cap.start)} - {formatTime(cap.end)}
            </span>
            <textarea
              value={cap.text}
              onChange={(e) => handleEdit(idx, e.target.value)}
              rows={2}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaptionEditor;