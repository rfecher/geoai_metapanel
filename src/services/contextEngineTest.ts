/*
 * Context Engine Calibration & Test Harness
 * - Simulates multi-persona rounds using the real Context Engine + LLM
 * - Prints rich diagnostics: prompts, keywords, Jaccard scores, SKIP decisions, topics, tensions, rolling history
 * - Run via: npm run test:context-engine
 */

import { createContextEngine } from './contextEngine.js';
import { chatWithLLM, LLM_PRESETS, type LLMConfig, type ChatMessage } from './llm.js';
import { personas } from '../data/personas.js';
import { setBackupConfig } from './backup.js';
import {
  questions,
  personaIds as cfgPersonaIds,
  llmPresetKey,
  personaModelsOverride,
  disableBackupAndHybrid,
  outputDir,
  enableFileOutput,
  diagnosticsFormat,
  enableFollowupEngagement,
  followupSnippetCount,
  maxTurnsPerPersonaPerQuestion,
} from './contextEngineTestConfig.js';
import { promises as fs } from 'fs';
import * as path from 'path';

// --- Local keyword extractor (mirrors logic in contextEngine.ts) ---
const STOPWORDS = new Set([
  'the','and','for','that','with','this','from','are','was','were','will','would','could','should','have','has','had','but','not','you','your','yours','about','into','out','our','they','them','their','then','when','what','which','how','why','where','who','whom','because','there','here','over','under','between','across','also','can','may','might','one','two','three','more','most','some','any','all','each','every','other','than','such','like','just','well','even','much','many','very','both','per','on','in','at','by','to','of','as','is','it','a','an','be','or','if','we','i'
]);
function extractKeywords(text: string): string[] {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter(t => t && !STOPWORDS.has(t) && t.length > 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) { if (!seen.has(t)) { seen.add(t); out.push(t); } }
  return out.slice(0, 20);
}
function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter(x => b.has(x))).size;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

// --- Utilities ---
function short(s: string, n = 160) { return (s || '').length > n ? s.slice(0, n) + '…' : s || ''; }
function ts() { return new Date().toISOString(); }
function fileSafeTimestamp() { return ts().replace(/[:.]/g, '-'); }
function getPersonaMap() {
  const map = new Map(personas.map(p => [p.id, p] as const));
  return map;
}

async function main() {
  if (disableBackupAndHybrid) {
    setBackupConfig({ mode: 'disabled', enabled: false });
  }

  const personaMap = getPersonaMap();
  const selectedIds = cfgPersonaIds.filter(id => personaMap.has(id));
  const selected = selectedIds.map(id => personaMap.get(id)!);
  if (selected.length === 0) {
    console.error('No valid personas selected in contextEngineTestConfig.ts');
    process.exit(1);
  }

  const llmConfig: LLMConfig = { ...LLM_PRESETS[llmPresetKey] };
  // Optional env overrides for CLI use
  try {
    // @ts-ignore
    if (typeof process !== 'undefined') {
      // Base URL override (e.g., http://localhost:11434)
      if (process.env.LLM_BASE_URL) llmConfig.baseUrl = process.env.LLM_BASE_URL;
      // API key for OpenAI-compatible providers
      const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
      if (apiKey) llmConfig.apiKey = apiKey;
      if (process.env.LLM_DEFAULT_MODEL) llmConfig.defaultModel = process.env.LLM_DEFAULT_MODEL;
    }
  } catch {}

  const runTimestamp = ts();
  console.log(`\n=== Context Engine Calibration Run @ ${runTimestamp} ===`);
  console.log('LLM preset:', llmPresetKey, llmConfig);
  console.log('Personas:', selected.map(p => `${p.name}(${p.id})`).join(', '));

  // Collect outputs for files
  type TranscriptItem = { question: string; responses: Array<{ personaId: string; personaName: string; text: string; skipped?: boolean }> };
  type JaccardOther = { personaName: string; score: number; sample: string };
  type PersonaDiag = {
    personaId: string;
    personaName: string;
    role: 'first' | 'other';
    model: string;
    systemPrompt: string;
    keywords: string[];
    jaccard?: { simSelf: number | null; topOthers: JaccardOther[] };
    repetition?: { isRepetitive: boolean };
    answer: string | null; // null if SKIP
    topicsAfter: any;
    tensionsAfter: any;
    historyAfter: Array<{ role: string; who?: string; text?: string }>;
    llm: { provider: string; baseUrl: string; model: string; startTime: string; endTime: string; durationMs: number; requestMessages: number; responseChars: number };
  };
  type QuestionDiag = { question: string; personas: PersonaDiag[]; finalHistory: Array<{ role: string; who?: string; text?: string }> };

  const transcript: TranscriptItem[] = [];
  const diagnostics: { run: any; questions: QuestionDiag[] } = {
    run: {
      timestamp: runTimestamp,
      llmPresetKey,
      provider: llmConfig.provider,
      baseUrl: llmConfig.baseUrl,
      defaultModel: llmConfig.defaultModel,
      personaIds: selectedIds,
      personaModels: Object.fromEntries(selected.map(p => [p.id, personaModelsOverride[p.id] || llmConfig.defaultModel])),
    },
    questions: [],
  };

  for (const q of questions) {
    console.log(`\n\n--- Question ---\n${q}`);

    // Fresh engine per question to isolate runs
    const engine = createContextEngine({
      maxHistoryMessages: 30,
      timeWindowMs: 10 * 60 * 1000,
      timeBudgetMsPerQuestion: 3 * 60 * 1000,
      enforceEngagementOnFollowups: enableFollowupEngagement,
      includeOtherSnippetsOnFollowups: enableFollowupEngagement,
      followupSnippetCount: followupSnippetCount,
      maxTurnsPerPersonaPerQuestion: maxTurnsPerPersonaPerQuestion,
    });

    const participants = selected.map(p => p.id);
    engine.startRound(q, participants);

    // Buffers for this question
    const qTranscript: TranscriptItem = { question: q, responses: [] };
    const qDiag: QuestionDiag = { question: q, personas: [], finalHistory: [] };

    // Choose first speaker deterministically as the first in list (for reproducibility)
    const first = selected[0];
    const others = selected.slice(1);

    console.log('\n[First Speaker]', first.name, `(model=${personaModelsOverride[first.id] || llmConfig.defaultModel})`);

    // Build enhanced system prompt and call LLM
    const sysFirst: ChatMessage = { role: 'system', content: engine.buildPersonaSystemPrompt(first.systemPrompt, first.id, first.name) };
    console.log('\n📝 System Prompt →', first.name, '\n' + sysFirst.content + '\n');

    const reqFirst: ChatMessage[] = [sysFirst, { role: 'user', content: q }];
    const modelFirst = personaModelsOverride[first.id] || llmConfig.defaultModel;
    const start1 = Date.now();
    let firstAnswer = await chatWithLLM(llmConfig, { model: modelFirst, messages: reqFirst, personaId: first.id });
    const end1 = Date.now();

    const kwFirst = extractKeywords(firstAnswer);
    console.log('🗝️ Keywords:', kwFirst.join(', '));
    console.log('💬 Answer:', firstAnswer, '\n');

    engine.ingestMessage({ id: `t-${Date.now()}-${first.id}`, role: 'assistant', personaId: first.id, author: first.name, text: firstAnswer, timestamp: Date.now() });

    // Diagnostics: topics, tensions, history
    console.log('📚 Topics:', engine.getTopTopics(10));
    console.log('⚖️ Tensions:', engine.getRecentTensions(10));
    console.log('🧾 History (last 3):', engine.getRollingHistory().slice(-3).map(m => ({ role: m.role, who: m.author || m.personaId, text: short(m.text) })));

    // Save transcript + diagnostics for first
    qTranscript.responses.push({ personaId: first.id, personaName: first.name, text: firstAnswer });
    qDiag.personas.push({
      personaId: first.id,
      personaName: first.name,
      role: 'first',
      model: modelFirst,
      systemPrompt: sysFirst.content,
      keywords: kwFirst,
      jaccard: { simSelf: null, topOthers: [] },
      repetition: { isRepetitive: false },
      answer: firstAnswer,
      topicsAfter: engine.getTopTopics(20),
      tensionsAfter: engine.getRecentTensions(20),
      historyAfter: engine.getRollingHistory().map(m => ({ role: m.role, who: (m as any).author || (m as any).personaId, text: (m as any).text })),
      llm: {
        provider: llmConfig.provider,
        baseUrl: llmConfig.baseUrl,
        model: modelFirst,
        startTime: new Date(start1).toISOString(),
        endTime: new Date(end1).toISOString(),
        durationMs: end1 - start1,
        requestMessages: reqFirst.length,
        responseChars: (firstAnswer || '').length,
      },
    });

    // Prepare context for others
    const historyAfterFirst: ChatMessage[] = [{ role: 'assistant', content: `${first.name}: ${firstAnswer}` }];

    for (const p of others) {
      console.log(`\n[Next Speaker] ${p.name} (model=${personaModelsOverride[p.id] || llmConfig.defaultModel})`);
      const sys: ChatMessage = { role: 'system', content: engine.buildPersonaSystemPrompt(p.systemPrompt, p.id, p.name) };
      console.log('\n📝 System Prompt →', p.name, '\n' + sys.content + '\n');

      const reqMsgs: ChatMessage[] = [sys, ...historyAfterFirst, { role: 'user', content: q }];
      const model = personaModelsOverride[p.id] || llmConfig.defaultModel;
      const start = Date.now();
      let answer = await chatWithLLM(llmConfig, { model, messages: reqMsgs, personaId: p.id });
      const end = Date.now();

      const kw = extractKeywords(answer);
      console.log('🗝️ Keywords:', kw.join(', '));

      // Cross-persona similarity (vs prior answers in this question)
      const kwSet = new Set(kw);
      const topOthers: JaccardOther[] = [];
      for (const r of qTranscript.responses) {
        const prevKw = new Set(extractKeywords(r.text));
        const score = jaccard(kwSet, prevKw);
        topOthers.push({ personaName: r.personaName, score, sample: short(r.text) });
      }
      topOthers.sort((a, b) => b.score - a.score);

      // Repetition detection (engine has internal logging too)
      const isRep = engine.responseIsRepetitive(answer, p.id);
      console.log('🔁 Repetition?', isRep);
      if (isRep) {
        console.log('⏭️ Marked as SKIP due to repetition');
      }

      if (!isRep) {
        console.log('💬 Answer:', answer, '\n');
        engine.ingestMessage({ id: `t-${Date.now()}-${p.id}`, role: 'assistant', personaId: p.id, author: p.name, text: answer, timestamp: Date.now() });
        qTranscript.responses.push({ personaId: p.id, personaName: p.name, text: answer });
      } else {
        qTranscript.responses.push({ personaId: p.id, personaName: p.name, text: 'SKIP', skipped: true });
      }

      qDiag.personas.push({
        personaId: p.id,
        personaName: p.name,
        role: 'other',
        model,
        systemPrompt: sys.content,
        keywords: kw,
        jaccard: { simSelf: null, topOthers: topOthers.slice(0, 3) },
        repetition: { isRepetitive: isRep },
        answer: isRep ? null : answer,
        topicsAfter: engine.getTopTopics(20),
        tensionsAfter: engine.getRecentTensions(20),
        historyAfter: engine.getRollingHistory().map(m => ({ role: m.role, who: (m as any).author || (m as any).personaId, text: (m as any).text })),
        llm: {
          provider: llmConfig.provider,
          baseUrl: llmConfig.baseUrl,
          model,
          startTime: new Date(start).toISOString(),
          endTime: new Date(end).toISOString(),
          durationMs: end - start,
          requestMessages: reqMsgs.length,
          responseChars: (answer || '').length,
        },
      });

      console.log('📚 Topics:', engine.getTopTopics(10));
      console.log('⚖️ Tensions:', engine.getRecentTensions(10));
      console.log('🧾 History (last 4):', engine.getRollingHistory().slice(-4).map(m => ({ role: m.role, who: m.author || m.personaId, text: short(m.text) })));
    }

    console.log('\n=== End of Round ===');

    qDiag.finalHistory = engine.getRollingHistory().map(m => ({ role: m.role, who: (m as any).author || (m as any).personaId, text: (m as any).text }));
    transcript.push(qTranscript);
    diagnostics.questions.push(qDiag);
  }

  // Write outputs if enabled
  if (enableFileOutput) {
    const dir = path.resolve(process.cwd(), outputDir || './context-engine-logs');
    await fs.mkdir(dir, { recursive: true });
    const stamp = fileSafeTimestamp();

    // Dialog transcript (.txt)
    let dialogText = `Context Engine Dialog Transcript - ${runTimestamp}\n`;
    for (const item of transcript) {
      dialogText += `\nQuestion: ${item.question}\n`;
      for (const r of item.responses) {
        dialogText += `\n${r.personaName}:\n${r.text}\n`;
      }
      dialogText += '\n';
    }
    const dialogPath = path.join(dir, `context-engine-dialog-${stamp}.txt`);
    await fs.writeFile(dialogPath, dialogText, 'utf8');

    // Diagnostics (json or txt)
    let diagPath: string;
    if (diagnosticsFormat === 'json') {
      diagPath = path.join(dir, `context-engine-diagnostics-${stamp}.json`);
      await fs.writeFile(diagPath, JSON.stringify(diagnostics, null, 2), 'utf8');
    } else {
      diagPath = path.join(dir, `context-engine-diagnostics-${stamp}.txt`);
      await fs.writeFile(diagPath, JSON.stringify(diagnostics, null, 2), 'utf8'); // fallback to JSON text
    }

    console.log(`\n💾 Saved dialog transcript → ${dialogPath}`);
    console.log(`💾 Saved diagnostics → ${diagPath}`);
  }

  console.log('\nDone.');
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

