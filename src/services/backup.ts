/**
 * Backup/Fallback Service
 * Provides graceful degradation when live AI models are unavailable
 * Integrates with pre-generated backup responses and generic fallbacks
 */

import { loadBackupResponses, findMatchingBackupQuestion, findMatchingBackupQuestionWithConfidence, getGenericFallbackResponse, MatchResult } from './backup-loader.js';

export type BackupMode = 'disabled' | 'auto' | 'always' | 'hybrid';

export interface BackupConfig {
  mode: BackupMode;
  enabled: boolean;
  lastFailureTime?: number;
  consecutiveFailures: number;
  autoEnableThreshold: number; // Number of consecutive failures before auto-enabling
}

// Global backup configuration
let backupConfig: BackupConfig = {
  mode: 'auto',
  enabled: false,
  consecutiveFailures: 0,
  autoEnableThreshold: 2, // Enable backup after 2 consecutive failures
};

// Listeners for backup state changes
type BackupStateListener = (config: BackupConfig) => void;
const backupStateListeners: BackupStateListener[] = [];

/**
 * Get current backup configuration
 */
export function getBackupConfig(): BackupConfig {
  return { ...backupConfig };
}

/**
 * Update backup configuration
 */
export function setBackupConfig(config: Partial<BackupConfig>): void {
  backupConfig = { ...backupConfig, ...config };
  notifyBackupStateListeners();
}

/**
 * Add a listener for backup state changes
 */
export function addBackupStateListener(listener: BackupStateListener): void {
  backupStateListeners.push(listener);
}

/**
 * Remove a backup state listener
 */
export function removeBackupStateListener(listener: BackupStateListener): void {
  const index = backupStateListeners.indexOf(listener);
  if (index > -1) {
    backupStateListeners.splice(index, 1);
  }
}

/**
 * Notify all listeners of backup state changes
 */
function notifyBackupStateListeners(): void {
  backupStateListeners.forEach(listener => listener(backupConfig));
}

/**
 * Record a successful LLM response (resets failure counter)
 */
export function recordSuccess(): void {
  if (backupConfig.consecutiveFailures > 0) {
    console.log('✅ LLM success - resetting failure counter');
    backupConfig.consecutiveFailures = 0;
    
    // If we were in auto-enabled backup mode, disable it
    if (backupConfig.mode === 'auto' && backupConfig.enabled) {
      console.log('🔄 Auto-disabling backup mode after successful LLM response');
      backupConfig.enabled = false;
      notifyBackupStateListeners();
    }
  }
}

/**
 * Record a failed LLM response (increments failure counter)
 */
export function recordFailure(): void {
  backupConfig.consecutiveFailures++;
  backupConfig.lastFailureTime = Date.now();
  
  console.warn(`⚠️ LLM failure recorded (${backupConfig.consecutiveFailures} consecutive failures)`);
  
  // Auto-enable backup mode if threshold is reached
  if (backupConfig.mode === 'auto' && 
      backupConfig.consecutiveFailures >= backupConfig.autoEnableThreshold &&
      !backupConfig.enabled) {
    console.log('🔄 Auto-enabling backup mode due to consecutive failures');
    backupConfig.enabled = true;
    notifyBackupStateListeners();
  }
}

/**
 * Check if backup mode should be used
 */
export function shouldUseBackup(): boolean {
  return backupConfig.mode === 'always' || backupConfig.enabled;
}

/**
 * Check if we're in hybrid mode
 */
export function isHybridMode(): boolean {
  return backupConfig.mode === 'hybrid';
}

/**
 * Get match result with confidence for hybrid mode decision-making
 */
export function getBackupMatchConfidence(question: string): MatchResult {
  return findMatchingBackupQuestionWithConfidence(question);
}

/**
 * Check if a match is strong enough to use in hybrid mode
 * Hybrid mode requires high confidence (>= 0.75) to use pre-generated response
 */
export function shouldUseBackupInHybridMode(question: string): boolean {
  const match = findMatchingBackupQuestionWithConfidence(question);
  return match.confidence >= 0.75 && match.questionId !== null;
}

/**
 * Get backup response for a persona and question
 * Returns null if no backup is available
 */
export async function getBackupResponse(
  question: string,
  personaId: string
): Promise<string | null> {
  try {
    // First, try to find a matching pre-generated backup
    const matchingQuestionId = findMatchingBackupQuestion(question);
    
    if (matchingQuestionId) {
      console.log(`📦 Found matching backup question: ${matchingQuestionId}`);
      const backupData = await loadBackupResponses(matchingQuestionId);
      
      if (backupData && backupData.responses[personaId]) {
        console.log(`✅ Using pre-generated backup response for ${personaId}`);
        return backupData.responses[personaId].content;
      }
    }
    
    // If no specific backup found, use generic fallback
    console.log(`📦 Using generic fallback response for ${personaId}`);
    return getGenericFallbackResponse(personaId);
  } catch (error) {
    console.error('❌ Error getting backup response:', error);
    return null;
  }
}

/**
 * Simulate streaming for backup responses
 * Chunks the response and calls the callback progressively
 */
export async function streamBackupResponse(
  response: string,
  onChunk: (chunk: string) => void,
  delayMs: number = 30
): Promise<void> {
  // Split response into words for more natural streaming
  const words = response.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    onChunk(chunk);
    
    // Add slight delay to simulate streaming
    if (i < words.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Get backup response with automatic fallback handling
 * This is the main entry point for getting backup responses
 */
export async function getBackupResponseWithFallback(
  question: string,
  personaId: string,
  streaming: boolean = false,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const response = await getBackupResponse(question, personaId);
  
  if (!response) {
    // Ultimate fallback if even generic responses fail
    const ultimateFallback = `I apologize, but I'm currently experiencing technical difficulties. Please try again in a moment.`;
    
    if (streaming && onChunk) {
      await streamBackupResponse(ultimateFallback, onChunk);
    }
    
    return ultimateFallback;
  }
  
  if (streaming && onChunk) {
    await streamBackupResponse(response, onChunk);
  }
  
  return response;
}

/**
 * Reset backup system state
 */
export function resetBackupState(): void {
  backupConfig.consecutiveFailures = 0;
  backupConfig.lastFailureTime = undefined;
  
  if (backupConfig.mode === 'auto') {
    backupConfig.enabled = false;
  }
  
  notifyBackupStateListeners();
}

/**
 * Get backup system status for UI display
 */
export function getBackupStatus(): {
  active: boolean;
  mode: BackupMode;
  consecutiveFailures: number;
  lastFailureTime?: number;
  message: string;
} {
  const active = shouldUseBackup();
  let message = '';
  
  if (backupConfig.mode === 'always') {
    message = 'Backup mode: Always active';
  } else if (backupConfig.mode === 'disabled') {
    message = 'Backup mode: Disabled';
  } else if (active) {
    message = `Backup mode: Active (${backupConfig.consecutiveFailures} failures detected)`;
  } else if (backupConfig.consecutiveFailures > 0) {
    message = `Backup mode: Monitoring (${backupConfig.consecutiveFailures}/${backupConfig.autoEnableThreshold} failures)`;
  } else {
    message = 'Backup mode: Ready';
  }
  
  return {
    active,
    mode: backupConfig.mode,
    consecutiveFailures: backupConfig.consecutiveFailures,
    lastFailureTime: backupConfig.lastFailureTime,
    message,
  };
}

