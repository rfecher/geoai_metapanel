import React, { useState, useEffect } from 'react';
import { LLMConfig, LLMProvider, LLM_PRESETS, testLLMConnection, listModels } from '../services/llm';

type Props = {
  config: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
  onModelsRefresh?: (models: string[]) => void;
};

export default function LLMProviderSelector({ config, onConfigChange, onModelsRefresh }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; models?: string[] } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  // Auto-fetch models when component mounts or config changes
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      const models = await listModels(config);
      setLoadingModels(false);
      if (onModelsRefresh) {
        onModelsRefresh(models);
      }
      // If we got models, consider it a successful connection
      if (models.length > 0) {
        setTestResult({ success: true, models });
      }
    };

    fetchModels();
  }, [config.baseUrl, config.provider]); // Re-fetch when provider or URL changes

  const handlePresetChange = (presetName: string) => {
    if (presetName === 'custom') {
      // Keep current config but mark as custom
      onConfigChange({ ...config, provider: 'custom' });
    } else {
      const preset = LLM_PRESETS[presetName];
      if (preset) {
        onConfigChange(preset);
        setTestResult(null);
      }
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testLLMConnection(config);
    setTestResult(result);
    setTesting(false);

    if (result.success && result.models && onModelsRefresh) {
      onModelsRefresh(result.models);
    }
  };

  const handleRefreshModels = async () => {
    setLoadingModels(true);
    const models = await listModels(config);
    setLoadingModels(false);
    if (onModelsRefresh) {
      onModelsRefresh(models);
    }
  };

  // Determine which preset is currently selected
  const currentPreset = Object.entries(LLM_PRESETS).find(
    ([_, preset]) => 
      preset.baseUrl === config.baseUrl && 
      preset.provider === config.provider
  )?.[0] || 'custom';

  return (
    <div className="llm-provider-selector">
      <div className="label">LLM Provider</div>
      <div className="provider-presets">
        <select
          value={currentPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="text-input"
        >
          <option value="ollama">Ollama (localhost:11434)</option>
          <option value="lmstudio">LM Studio (localhost:1234)</option>
          <option value="openai">OpenAI API</option>
          <option value="mlx">MLX-LM (127.0.0.1:8080)</option>
          <option value="custom">Custom Configuration</option>
        </select>
      </div>

      <div className="provider-details">
        <div className="label">Base URL</div>
        <input
          className="text-input"
          value={config.baseUrl}
          onChange={(e) => onConfigChange({ ...config, baseUrl: e.target.value })}
          placeholder="http://localhost:1234"
        />

        {(config.provider === 'openai' || config.provider === 'custom') && (
          <>
            <div className="label">API Key (optional)</div>
            <input
              className="text-input"
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </>
        )}

        <div className="label">Default Model</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            value={config.defaultModel}
            onChange={(e) => onConfigChange({ ...config, defaultModel: e.target.value })}
            placeholder="model-name"
          />
          <button 
            onClick={handleRefreshModels} 
            disabled={loadingModels}
            style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
          >
            {loadingModels ? '...' : '🔄 Refresh'}
          </button>
        </div>

        <div style={{ marginTop: '12px' }}>
          <button 
            onClick={handleTestConnection} 
            disabled={testing}
            style={{ width: '100%' }}
          >
            {testing ? 'Testing...' : '🔌 Test Connection'}
          </button>
        </div>

        {testResult && (
          <div 
            className="test-result" 
            style={{
              marginTop: '8px',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: testResult.success ? '#10b98120' : '#ef444420',
              color: testResult.success ? '#10b981' : '#ef4444',
              fontSize: '13px'
            }}
          >
            {testResult.success ? (
              <>
                ✓ Connected successfully
                {testResult.models && testResult.models.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
                    Found {testResult.models.length} model(s)
                  </div>
                )}
              </>
            ) : (
              <>✗ Connection failed: {testResult.error}</>
            )}
          </div>
        )}
      </div>

      <div className="provider-info" style={{ 
        marginTop: '12px', 
        padding: '8px', 
        backgroundColor: '#f3f4f6', 
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <strong>Quick Setup:</strong>
        <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
          <li><strong>Ollama:</strong> Run <code>ollama serve</code> in terminal</li>
          <li><strong>LM Studio:</strong> Start local server in LM Studio app (→ tab)</li>
          <li><strong>OpenAI:</strong> Add your API key above</li>
          <li><strong>MLX-LM:</strong> Start with <code>python3 -m mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit --host 127.0.0.1 --port 8080 --use-default-chat-template</code></li>
        </ul>
      </div>
    </div>
  );
}

