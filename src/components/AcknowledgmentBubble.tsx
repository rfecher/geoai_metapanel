import React, { useState, useEffect } from 'react';
import { Persona } from '../data/personas';
import TypingIndicator from './TypingIndicator';

type Props = {
  persona: Persona;
  isUser?: boolean;
  showTypingIndicator?: boolean;
  acknowledgmentText?: string; // Optional pre-selected acknowledgment text
};

/**
 * Pre-canned acknowledgment phrases by persona
 * These are shown immediately while the LLM generates the full response
 */
const ACKNOWLEDGMENTS: Record<string, string[]> = {
  maya: [
    "Let me consider that...",
    "That's an important question...",
    "Thinking about the implications...",
    "From a community perspective...",
    "Let me reflect on this...",
  ],
  otto: [
    "Interesting query...",
    "Let me examine this systematically...",
    "From a technical standpoint...",
    "Analyzing the specifications...",
    "Let me consult the standards...",
  ],
  marcus: [
    "Good question...",
    "Let me break this down...",
    "Here's what I'm thinking...",
    "From a strategic angle...",
    "Let me assess this...",
  ],
  aria: [
    "Fascinating...",
    "Let me explore that...",
    "I see several angles here...",
    "From a research perspective...",
    "Let me investigate...",
  ],
  jessica: [
    "Noted...",
    "Analyzing the situation...",
    "From an operational perspective...",
    "Assessing the tactical implications...",
    "Let me evaluate this...",
  ],
};

/**
 * Get a random acknowledgment for a persona
 * Exported so it can be used for TTS in App.tsx
 */
export function getAcknowledgment(personaId: string): string {
  const phrases = ACKNOWLEDGMENTS[personaId] || [
    "Let me think about that...",
    "Interesting question...",
    "Considering this...",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Acknowledgment bubble component
 * Shows a brief acknowledgment message with typing indicator
 */
export default function AcknowledgmentBubble({ persona, isUser = false, showTypingIndicator = true, acknowledgmentText }: Props) {
  // Use provided acknowledgmentText if available, otherwise generate one
  const [acknowledgment] = useState(() => acknowledgmentText || getAcknowledgment(persona.id));
  const [showText, setShowText] = useState(!showTypingIndicator); // If no typing indicator, show text immediately

  // Show typing indicator first, then text after a brief delay
  useEffect(() => {
    if (!showTypingIndicator) return; // Skip delay if typing indicator is disabled

    const timer = setTimeout(() => {
      setShowText(true);
    }, 300 + Math.random() * 400); // 300-700ms delay for variety

    return () => clearTimeout(timer);
  }, [showTypingIndicator]);

  return (
    <div className={`row ${isUser ? 'reverse' : ''}`}>
      <div className="avatar" style={{ backgroundColor: persona.color }}>
        {persona.imageUrl ? (
          <img src={persona.imageUrl} alt={persona.name} className="avatar-img" />
        ) : (
          persona.avatarInitials
        )}
      </div>
      <div className={`bubble ${isUser ? 'user' : 'persona'} acknowledgment-bubble`}>
        <div className="author">{persona.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' }}>
          {!showText ? (
            <TypingIndicator persona={persona} size="small" />
          ) : (
            <span style={{ 
              fontStyle: 'italic', 
              color: '#6b7280',
              animation: 'fadeIn 0.3s ease-in',
            }}>
              {acknowledgment}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .acknowledgment-bubble {
          opacity: 0.85;
          transition: opacity 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

