import React from 'react';
import { Persona } from '../data/personas';

type Props = {
  persona: Persona;
  size?: 'small' | 'medium' | 'large';
};

/**
 * Typing indicator with persona-specific styling
 * Shows animated dots that reflect each persona's thinking style
 */
export default function TypingIndicator({ persona, size = 'medium' }: Props) {
  // Persona-specific animation speeds and styles
  const getPersonaStyle = (personaId: string) => {
    const styles: Record<string, { speed: number; pattern: 'steady' | 'methodical' | 'quick' | 'contemplative' }> = {
      maya: { speed: 1.2, pattern: 'contemplative' }, // Thoughtful, measured
      otto: { speed: 1.5, pattern: 'methodical' },    // Systematic, precise
      marcus: { speed: 0.8, pattern: 'quick' },       // Fast, decisive
      aria: { speed: 1.0, pattern: 'steady' },        // Balanced, flowing
      jessica: { speed: 1.1, pattern: 'steady' },     // Professional, consistent
    };
    return styles[personaId] || { speed: 1.0, pattern: 'steady' };
  };

  const style = getPersonaStyle(persona.id);
  const baseDelay = 400; // Base delay in ms
  const animationDuration = baseDelay * 3 * style.speed; // Total cycle time

  // Size-based dot dimensions
  const dotSizes = {
    small: { size: 6, gap: 4 },
    medium: { size: 8, gap: 5 },
    large: { size: 10, gap: 6 },
  };
  const { size: dotSize, gap } = dotSizes[size];

  return (
    <div 
      className="typing-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap}px`,
        padding: '8px 12px',
      }}
      aria-label={`${persona.name} is typing`}
    >
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-${dotSize * 0.8}px);
            opacity: 1;
          }
        }

        @keyframes typing-pulse {
          0%, 60%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          30% {
            transform: scale(1.3);
            opacity: 1;
          }
        }

        @keyframes typing-fade {
          0%, 60%, 100% {
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
        }

        .typing-dot {
          width: ${dotSize}px;
          height: ${dotSize}px;
          border-radius: 50%;
          background-color: ${persona.color};
          animation-duration: ${animationDuration}ms;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }

        .typing-dot.bounce {
          animation-name: typing-bounce;
        }

        .typing-dot.pulse {
          animation-name: typing-pulse;
        }

        .typing-dot.fade {
          animation-name: typing-fade;
        }
      `}</style>

      {/* Three dots with staggered animation */}
      {[0, 1, 2].map((index) => {
        const delay = index * (baseDelay * style.speed);
        const animationClass = 
          style.pattern === 'quick' ? 'pulse' :
          style.pattern === 'methodical' ? 'fade' :
          'bounce';

        return (
          <div
            key={index}
            className={`typing-dot ${animationClass}`}
            style={{
              animationDelay: `${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

