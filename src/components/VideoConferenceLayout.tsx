import React from 'react';
import { Persona } from '../data/personas';
import SvgAnimatedAvatar from "./SvgAnimatedAvatar";

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
  onPlayIntro: (personaId: string) => void;
  busy: boolean;
  generatedAvatars?: Record<string, string>;
  useGeneratedAvatars?: boolean;
};

export default function VideoConferenceLayout({
  personas,
  speakingPersonaId,
  audioAmplitudes,
  visemesByPersona,
  layoutMode,
  personaModels,
  defaultModel,
  inFlight,
  onPlayIntro,
  busy,
  generatedAvatars = {},
  useGeneratedAvatars = false,
}: VideoConferenceLayoutProps) {
  const speakingPersona = personas.find(p => p.id === speakingPersonaId);



  if (layoutMode === 'speaker' && speakingPersona) {
    // Speaker mode: Large speaker with small thumbnails
    const otherPersonas = personas.filter(p => p.id !== speakingPersonaId);

    return (
      <div className="video-conference speaker-mode">
        {/* Main speaker view */}
        <div className="speaker-main">
          <div className="speaker-content">
              <SvgAnimatedAvatar
                svgUrl={speakingPersona.imageUrl}
                name={speakingPersona.name}
                color={speakingPersona.color}
                size="large"
                isSpeaking={true}
                audioAmplitude={audioAmplitudes[speakingPersona.id] || 0}
                visemePose={visemesByPersona[speakingPersona.id]}
                animationConfig={speakingPersona.animationConfig}
              />
            <div className="speaker-info">
              <div className="speaker-name" style={{ color: speakingPersona.color }}>
                {speakingPersona.name}
              </div>
              <div className="speaker-bio">{speakingPersona.shortBio}</div>
              <div className="speaker-badges">
                <span className="badge model">
                  {personaModels[speakingPersona.id] || defaultModel}
                </span>
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
                <SvgAnimatedAvatar
                  svgUrl={p.imageUrl}
                  name={p.name}
                  color={p.color}
                  size="small"
                  isSpeaking={false}
                  audioAmplitude={0}
                  visemePose={visemesByPersona[p.id]}
                  animationConfig={p.animationConfig}
                />
                <div className="thumbnail-info">
                  <div className="thumbnail-name">{p.name}</div>
                  {thinking && <span className="badge thinking mini">thinking</span>}
                  {p.intro && (
                    <button
                      className="intro-button mini"
                      onClick={() => onPlayIntro(p.id)}
                      disabled={busy}
                      title={`Play ${p.name}'s introduction`}
                    >
                      🎤
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid mode: Equal-sized tiles for all participants
  return (
    <div className="video-conference grid-mode">
      <div className="grid-container">
        {personas.map(p => {
          const speaking = speakingPersonaId === p.id;
          const thinking = inFlight.has(p.id);
          const usedModel = personaModels[p.id] || defaultModel;

          return (
            <div key={p.id} className={`grid-item ${speaking ? 'speaking' : ''}`}>
                <SvgAnimatedAvatar
                  svgUrl={p.imageUrl}
                  name={p.name}
                  color={p.color}
                  size="medium"
                  isSpeaking={speaking}
                  audioAmplitude={audioAmplitudes[p.id] || 0}
                  visemePose={visemesByPersona[p.id]}
                  animationConfig={p.animationConfig}
                />
              <div className="grid-info">
                <div className="grid-name" style={{ color: speaking ? p.color : '#111827' }}>
                  {p.name}
                </div>
                <div className="grid-bio">{p.shortBio}</div>
                <div className="grid-badges">
                  <span className="badge model mini">{usedModel}</span>
                  {thinking && <span className="badge thinking mini">thinking</span>}
                  {p.intro && (
                    <button
                      className="intro-button mini"
                      onClick={() => onPlayIntro(p.id)}
                      disabled={busy || speaking}
                      title={`Play ${p.name}'s introduction`}
                    >
                      🎤
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

