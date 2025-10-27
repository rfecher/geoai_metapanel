import React, { useState } from 'react';
import AvatarCalibrationTool from './AvatarCalibrationTool';
import { Persona } from '../data/personas';

type SettingsTab = 'general' | 'avatars' | 'calibration';

type SettingsProps = {
  children: React.ReactNode; // General settings content from App.tsx
  onClose?: () => void;
  initialTab?: SettingsTab;
  // Props for calibration tab
  personas?: Persona[];
  generatedAvatars?: Record<string, string>;
  useGeneratedAvatars?: boolean;
};

export default function Settings({ children, onClose, initialTab = 'general', personas = [], generatedAvatars = {}, useGeneratedAvatars = false }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settings</h2>
          {onClose && (
            <button 
              className="settings-close-btn"
              onClick={onClose}
              title="Close settings"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            ⚙️ General
          </button>
          <button
            className={`settings-tab ${activeTab === 'calibration' ? 'active' : ''}`}
            onClick={() => setActiveTab('calibration')}
          >
            🎯 Avatar Calibration
          </button>
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-tab-panel">
              {children}
            </div>
          )}

          {activeTab === 'calibration' && personas.length > 0 && (
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <AvatarCalibrationTool
                personas={personas}
                generatedAvatars={generatedAvatars}
                useGeneratedAvatars={useGeneratedAvatars}
                embedded={true}
                onClose={() => {
                  // Don't close the entire settings modal, just switch back to general tab
                  setActiveTab('general');
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease-out;
        }

        .settings-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 95vw;
          height: 95vh;
          max-width: 1400px;
          max-height: 900px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .settings-close-btn {
          background: transparent;
          border: none;
          font-size: 24px;
          color: #6b7280;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .settings-close-btn:hover {
          background: #e5e7eb;
          color: #111827;
        }

        .settings-tabs {
          display: flex;
          gap: 4px;
          padding: 8px 12px 0;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .settings-tab {
          background: transparent;
          border: none;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          border-radius: 8px 8px 0 0;
          transition: all 0.2s;
          position: relative;
        }

        .settings-tab:hover {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .settings-tab.active {
          background: white;
          color: #111827;
          box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
        }

        .settings-tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #3b82f6;
        }

        .settings-content {
          flex: 1;
          overflow: hidden;
          background: white;
        }

        .settings-tab-panel {
          height: 100%;
          overflow-y: auto;
          padding: 20px;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Scrollbar styling for settings panel */
        .settings-tab-panel::-webkit-scrollbar {
          width: 8px;
        }

        .settings-tab-panel::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .settings-tab-panel::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .settings-tab-panel::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

