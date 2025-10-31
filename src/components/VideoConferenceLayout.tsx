import React, { useEffect, useRef, useState } from 'react';
import { Persona } from '../data/personas';
import BrandedAvatar from "./BrandedAvatar";

type LayoutMode = 'speaker' | 'grid';

type VideoConferenceLayoutProps = {
  personas: Persona[];
  speakingPersonaId?: string;
  audioAmplitudes: Record<string, number>;
  visemesByPersona: Record<string, { viseme: string; open: number; wide: number; round: number }>;
  layoutMode: LayoutMode;
  personaModels: Record<string, string>;
  defaultModel: string;
  inFlight: Set<string>;
  busy: boolean;
  generatedAvatars?: Record<string, string>;
  useGeneratedAvatars?: boolean;
  enableListeningAnimations?: boolean;
  meetingMode?: boolean;
};

// Helper function to render the BrandedAvatar component
function renderAvatar(
  persona: Persona,
  size: 'small' | 'medium' | 'large' | 'xlarge',
  isSpeaking: boolean,
  isListening: boolean,
  audioAmplitude: number,
  visemePose: { viseme: string; open: number; wide: number; round: number } | undefined
) {
  return (
    <BrandedAvatar
      personaId={persona.id}
      name={persona.name}
      size={size}
      isSpeaking={isSpeaking}
      isListening={isListening}
      audioAmplitude={audioAmplitude}
      visemePose={visemePose}
      faceAnchors={persona.faceAnchors}
      animationConfig={persona.animationConfig}
    />
  );
}

export default function VideoConferenceLayout({
  personas,
  speakingPersonaId,
  audioAmplitudes,
  visemesByPersona,
  layoutMode,
  personaModels,
  defaultModel,
  inFlight,
  busy,
  generatedAvatars = {},
  useGeneratedAvatars = false,
  enableListeningAnimations = true,
  meetingMode = false,
}: VideoConferenceLayoutProps) {
  const speakingPersona = personas.find(p => p.id === speakingPersonaId);

  // Check if all personas use the same model (to hide redundant model display)
  const allModels = personas.map(p => personaModels[p.id] || defaultModel);
  const uniqueModels = new Set(allModels);
  const showModelBadges = uniqueModels.size > 1;
  // Responsive breakpoint for sizing avatar variants
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onResize = () => setIsSmallScreen(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Choose sizes conditionally based on meeting mode and screen size
  const speakerSize: 'large' | 'xlarge' = meetingMode ? (isSmallScreen ? 'large' : 'xlarge') : 'large';
  const gridSize: 'medium' | 'large' = meetingMode ? (isSmallScreen ? 'medium' : 'large') : 'medium';

  if (layoutMode === 'speaker' && speakingPersona) {
    // Speaker mode: Large speaker with small thumbnails
    const otherPersonas = personas.filter(p => p.id !== speakingPersonaId);

    return (
      <div className="video-conference speaker-mode">
        {/* Main speaker view */}
        <div className="speaker-main">
          <div className="speaker-content">
              {renderAvatar(
                speakingPersona,
                speakerSize,
                true,
                false,
                audioAmplitudes[speakingPersona.id] || 0,
                visemesByPersona[speakingPersona.id]
              )}
            <div className="speaker-info">
              <div className="speaker-name" style={{ color: speakingPersona.color }}>
                {speakingPersona.name}
              </div>
              <div className="speaker-bio">{speakingPersona.shortBio}</div>
              <div className="speaker-badges">
                {showModelBadges && (
                  <span className="badge model">
                    {personaModels[speakingPersona.id] || defaultModel}
                  </span>
                )}
                {inFlight.has(speakingPersona.id) && (
                  <span className="badge thinking">thinking</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail strip for other participants */}
        <div className="thumbnail-strip">
          {otherPersonas.map(p => {
            const thinking = inFlight.has(p.id);
            return (
              <div key={p.id} className="thumbnail-item">
                {renderAvatar(
                  p,
                  "small",
                  false,
                  enableListeningAnimations && !!speakingPersonaId,
                  0,
                  visemesByPersona[p.id]
                )}
                <div className="thumbnail-info">
                  <div className="thumbnail-name">{p.name}</div>
                  {thinking && <span className="badge thinking mini">thinking</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="brand-corner-logo brand-speaker-overlay">
          <img src="/avatars/vantor.svg" alt="Vantor" className="brand-logo" />
        </div>
      </div>
    );
  }

  // Grid mode: Equal-sized tiles for all participants
  return (
    <div className="video-conference grid-mode">
      <div ref={gridRef} className="grid-container">
        {personas.map(p => {
          const speaking = speakingPersonaId === p.id;
          const thinking = inFlight.has(p.id);
          const usedModel = personaModels[p.id] || defaultModel;

          return (
            <div key={p.id} className={`grid-item ${speaking ? 'speaking' : ''}`}>
                {renderAvatar(
                  p,
                  gridSize,
                  speaking,
                  enableListeningAnimations && !speaking && !!speakingPersonaId,
                  audioAmplitudes[p.id] || 0,
                  visemesByPersona[p.id]
                )}
              <div className="grid-info">
                <div className="grid-name" style={{ color: speaking ? p.color : '#111827' }}>
                  {p.name}
                </div>
                <div className="grid-bio">{p.shortBio}</div>
                <div className="grid-badges">
                  {showModelBadges && <span className="badge model mini">{usedModel}</span>}
                  {thinking && <span className="badge thinking mini">thinking</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="brand-corner-logo">
          <img src="/avatars/vantor.svg" alt="Vantor" className="brand-logo" />
        </div>

      </div>
    </div>
  );

}

