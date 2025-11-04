export const questions: string[] = [
  "What brought you to GeoAI, and what keeps you up at night about where it's headed?",
  "What's the biggest misconception about GeoAI in the open source community right now?",
    "What's one open source GeoAI tool that doesn't exist yet but desperately should?",
    "How do we validate AI-generated maps in disaster response when time is critical?",
    "In 5 years, will GeoAI be dominated by a few big models, or will we see a flourishing ecosystem of specialized local models?",
    "What would it take for you to trust a GeoAI system with a life-or-death decision?",
    "Should this panel exist? Are AI personas a useful tool for exploring these issues, or are we just creating noise?",
    "If you could send one message to the FOSS4G community about GeoAI, what would it be?"
];

// Optional: restrict to a subset of personas (ids from src/data/personas.ts)
export const personaIds: string[] = ['maya', 'otto', 'sarah', 'marcus', 'jessica'];

// Which LLM preset to use (see LLM_PRESETS in src/services/llm.ts)
export const llmPresetKey: 'ollama' | 'lmstudio' | 'openai' | 'mlx' = 'mlx';

// Optionally assign specific models per persona (leave empty to use defaultModel)
export const personaModelsOverride: Record<string, string> = {
    'maya': 'openai/gpt-oss-120b',
    'otto': 'openai/gpt-oss-120b',
    'sarah': 'openai/gpt-oss-120b',
    'marcus': 'openai/gpt-oss-120b',
    'jessica': 'openai/gpt-oss-120b',
  // e.g., 'maya': 'mistral', 'otto': 'llama3.1', 'sarah': 'gemma:7b'
};

// For calibration, disable backup/hybrid so we always hit the live LLM
export const disableBackupAndHybrid = true;

// --- Output configuration ---
export const outputDir = './context-engine-logs';
export const enableFileOutput = true;
export type DiagnosticsFormat = 'json' | 'txt';
export const diagnosticsFormat: DiagnosticsFormat = 'json';


// --- Follow-up engagement configuration ---
export const enableFollowupEngagement = true;
export const followupSnippetCount = 2; // how many recent remarks from others to include in follow-up prompts
export const maxTurnsPerPersonaPerQuestion: number | null = 2; // set to null to disable cap

