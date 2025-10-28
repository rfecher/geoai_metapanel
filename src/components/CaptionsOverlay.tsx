import React, { useEffect, useState } from 'react';

export interface CaptionsOverlayProps {
  visible: boolean;
  text?: string;
  personaName?: string;
  color?: string;
}

// Simple sanitizer to strip any HTML-like markup from text
function sanitize(text: string) {
  return text.replace(/<[^>]+>/g, '').trim();
}

export default function CaptionsOverlay({ visible, text, personaName, color }: CaptionsOverlayProps) {
  const cleaned = text ? sanitize(text) : '';
  const isShowing = !!visible && !!cleaned;

  // Preserve last non-empty content for fade-out animation
  const [lastText, setLastText] = useState<string>('');
  const [lastPersona, setLastPersona] = useState<string>('');
  const [lastColor, setLastColor] = useState<string>('#fff');

  useEffect(() => {
    if (cleaned) {
      setLastText(cleaned);
      setLastPersona(personaName || '');
      setLastColor(color || '#fff');
    }
  }, [cleaned, personaName, color]);

  const displayText = isShowing ? cleaned : lastText;
  const displayPersona = isShowing ? (personaName || '') : lastPersona;
  const displayColor = isShowing ? (color || '#fff') : lastColor;

  // Render wrapper always (when component is mounted) to allow CSS show/hide transitions
  if (!displayText) return null;

  return (
    <div
      className={`captions-overlay ${isShowing ? 'show' : 'hide'}`}
      role="region"
      aria-live={isShowing ? 'polite' : 'off'}
      aria-atomic={true}
    >
      <div className="captions-box">
        {displayPersona ? (
          <span className="captions-speaker" style={{ color: displayColor }}>
            {displayPersona}:
          </span>
        ) : null}
        <span className="captions-text">{displayText}</span>
      </div>
    </div>
  );
}
