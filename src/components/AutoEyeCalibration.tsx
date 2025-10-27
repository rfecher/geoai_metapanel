import React, { useState } from 'react';
import { autoCalibrateBatch, EyeCalibrationResult } from '../utils/eyeCalibration';

type AutoEyeCalibrationProps = {
  personaIds: string[];
  onClose: () => void;
  onApply: (results: Record<string, EyeCalibrationResult>) => void;
};

export default function AutoEyeCalibration({ personaIds, onClose, onApply }: AutoEyeCalibrationProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, EyeCalibrationResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCalibration = async () => {
    setRunning(true);
    setError(null);
    try {
      const calibrationResults = await autoCalibrateBatch(personaIds);
      setResults(calibrationResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const handleApply = () => {
    if (results) {
      onApply(results);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#1f2937',
        borderRadius: 12,
        padding: 24,
        maxWidth: 600,
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        color: '#e5e7eb',
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600 }}>
          Automatic Eye Calibration
        </h2>

        <p style={{ margin: '0 0 16px 0', color: '#9ca3af', fontSize: 14 }}>
          This tool analyzes the original avatar PNG images (<code>{'{personaId}'}.png</code>) to automatically detect pupil positions
          and calculate calibration parameters (<code>eyeSeparationPct</code>, <code>eyeCenterOffsetPct</code>).
        </p>

        {!results && !running && (
          <button
            onClick={runCalibration}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            Run Auto-Calibration
          </button>
        )}

        {running && (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>
              Analyzing eye images...
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: '#7f1d1d',
            border: '1px solid #991b1b',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 14,
          }}>
            Error: {error}
          </div>
        )}

        {results && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
                Calibration Results
              </h3>
              
              {Object.entries(results).length === 0 && (
                <div style={{ color: '#f59e0b', fontSize: 14 }}>
                  No pupils detected with sufficient confidence in the avatar images. Try manual calibration instead.
                </div>
              )}

              {Object.entries(results).map(([personaId, result]) => (
                <div
                  key={personaId}
                  style={{
                    background: '#374151',
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>
                    {personaId}
                  </div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6 }}>
                    <div>eyeSeparationPct: {result.eyeSeparationPct.toFixed(2)}%</div>
                    <div>eyeCenterOffsetPct: {result.eyeCenterOffsetPct.toFixed(2)}%</div>
                    <div>leftPupilXPct: {result.leftPupilXPct.toFixed(2)}%</div>
                    <div>rightPupilXPct: {result.rightPupilXPct.toFixed(2)}%</div>
                    <div>pupilYPct: {result.pupilYPct.toFixed(2)}%</div>
                    <div style={{ color: result.confidence > 0.6 ? '#10b981' : result.confidence > 0.4 ? '#f59e0b' : '#ef4444' }}>
                      confidence: {(result.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16, padding: 12, background: '#1e3a8a', borderRadius: 6, fontSize: 13 }}>
              <strong>Next steps:</strong>
              <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>Click "Apply to Personas" to update the faceAnchors in personas.ts</li>
                <li>Copy the generated code and paste it into src/data/personas.ts</li>
                <li>Rebuild the application</li>
              </ol>
            </div>

            {Object.entries(results).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>
                  Code to add to personas.ts:
                </h4>
                <pre style={{
                  background: '#111827',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: 200,
                }}>
{Object.entries(results).map(([personaId, result]) => `
// ${personaId} - Auto-calibrated from ${personaId}.png
faceAnchors: {
  ...existingFaceAnchors,
  eyeSeparationPct: ${result.eyeSeparationPct.toFixed(2)},
  eyeCenterOffsetPct: ${result.eyeCenterOffsetPct.toFixed(2)},
}`).join('\n')}
                </pre>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#374151',
              color: '#e5e7eb',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {results && Object.entries(results).length > 0 && (
            <button
              onClick={handleApply}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Copy Code & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

