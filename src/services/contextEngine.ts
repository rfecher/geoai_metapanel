/*
 * Conversation Context Engine
 * - Maintains rolling history with retention by message count and/or time window
 * - Tracks topics/themes and tension points (agreements/disagreements)
 * - Builds persona-enhanced system prompts with current context
 * - Provides selection algorithm for first panelist per round
 */

export type ContextRole = 'user' | 'assistant';

export type ContextMessage = {
  id: string;
  role: ContextRole;
  personaId?: string; // for assistant messages
  author?: string;
  text: string;
  timestamp: number;
  excludeFromHistory?: boolean; // acknowledgments, placeholders, control messages
};

export type TensionType = 'agreement' | 'disagreement';

export type TensionPoint = {
  id: string;
  topic?: string;
  between: string[]; // personaIds involved
  type: TensionType;
  quote?: string; // short excerpt
  lastUpdated: number;
};

export type Topic = {
  term: string;
  weight: number; // recency-weighted frequency
  lastMentioned: number;
};

export type EngineConfig = {
  maxHistoryMessages?: number; // default 30
  timeWindowMs?: number; // default 10 minutes
  timeBudgetMsPerQuestion?: number; // default 180000 (3 min)
  // Follow-up engagement behavior
  enforceEngagementOnFollowups?: boolean; // default true
  includeOtherSnippetsOnFollowups?: boolean; // default true
  followupSnippetCount?: number; // default 2-3
  // Optional cap on how many turns each persona may take per question
  maxTurnsPerPersonaPerQuestion?: number | null; // default null (no limit)
};

export type RoundState = {
  roundId: string;
  question: string;
  participants: string[]; // personaIds
  startTime: number;
  firstSpeakerId?: string;
};

export type ContextEngine = ReturnType<typeof createContextEngine>;

// Very small english stopword set for topic extraction (keep simple and local)
const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','of','to','in','on','with','by','is','are','was','were','be','been','being','this','that','it','as','at','from','about','into','over','after','before','up','down','out','off','again','further','more','most','least','very','so','just','can','could','should','would','may','might','will','shall','do','does','did','not','no','yes','you','your','we','our','they','their','i','me','my'
]);

function now() { return Date.now(); }

function extractKeywords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter(t => t && !STOPWORDS.has(t) && t.length > 2);
  // de-duplicate but keep order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out.slice(0, 20);
}

function short(text: string, n = 140) {
  return text.length <= n ? text : text.slice(0, n - 1) + '…';
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter(x => b.has(x))).size;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

export function createContextEngine(config: EngineConfig = {}) {
  const maxHistoryMessages = config.maxHistoryMessages ?? 30;
  const timeWindowMs = config.timeWindowMs ?? 10 * 60 * 1000; // 10 minutes
  const timeBudgetMsPerQuestion = config.timeBudgetMsPerQuestion ?? 3 * 60 * 1000; // 3 minutes

  // Internal state
  let history: ContextMessage[] = [];
  let topics = new Map<string, Topic>();
  let tensions: TensionPoint[] = [];
  let lastSpokeAt = new Map<string, number>(); // personaId -> timestamp

	  // Follow-up engagement configuration
	  const enforceEngagementOnFollowups = config.enforceEngagementOnFollowups ?? true;
	  const includeOtherSnippetsOnFollowups = config.includeOtherSnippetsOnFollowups ?? true;
	  const followupSnippetCount = config.followupSnippetCount ?? 2;
	  const maxTurnsPerPersonaPerQuestion = config.maxTurnsPerPersonaPerQuestion ?? null;


  let currentRound: RoundState | null = null;
  let roundSpeakCounts = new Map<string, number>();


  function pruneHistory() {
    const cutoff = now() - timeWindowMs;
    history = history.filter(m => m.timestamp >= cutoff);
    if (history.length > maxHistoryMessages) {
      history = history.slice(history.length - maxHistoryMessages);
    }
  }

  function updateTopicsFromText(text: string) {
    const kws = extractKeywords(text);
    const t = now();
    for (const term of kws) {
      const existing = topics.get(term);
      if (existing) {
        existing.weight = existing.weight * 0.9 + 1.0; // decay + bump
        existing.lastMentioned = t;
      } else {
        topics.set(term, { term, weight: 1.0, lastMentioned: t });
      }
    }
    // decay others
    topics.forEach((v, k) => {
      if (!kws.includes(k)) v.weight *= 0.98;
      if (v.weight < 0.05) topics.delete(k);
    });
  }

  function detectTensions(text: string, personaId?: string) {
    if (!personaId || !currentRound) return;
    const lower = text.toLowerCase();
    for (const other of currentRound.participants) {
      if (other === personaId) continue;
      // naive name detection by id mention or capitalized token (assumes ids used as labels elsewhere)
      const agreePatterns = [
        `agree with ${other}`, `i agree with ${other}`, `${other} is right`, `${other} makes`, 'good point'
      ];
      const disagreePatterns = [
        `disagree with ${other}`, `i disagree with ${other}`, `${other} is wrong`, 'i challenge', 'i push back'
      ];
      const matchedAgree = agreePatterns.some(p => lower.includes(p));
      const matchedDisagree = disagreePatterns.some(p => lower.includes(p));
      if (matchedAgree || matchedDisagree) {
        const id = `${personaId}-${other}-${matchedAgree ? 'agree' : 'disagree'}`;
        const existing = tensions.find(tp => tp.id === id);
        if (existing) {
          existing.lastUpdated = now();
          if (!existing.quote && text) existing.quote = short(text, 160);
        } else {
          tensions.push({ id, between: [personaId, other], type: matchedAgree ? 'agreement' : 'disagreement', lastUpdated: now(), quote: short(text, 160) });
        }
      }
    }
  }

  function ingestMessage(msg: ContextMessage) {
    if (!msg.excludeFromHistory) {
      history.push(msg);
      pruneHistory();
      updateTopicsFromText(msg.text);
      detectTensions(msg.text, msg.personaId);
      if (msg.personaId && msg.role === 'assistant') {
        lastSpokeAt.set(msg.personaId, msg.timestamp);
        if (currentRound && msg.timestamp >= currentRound.startTime) {
          const prev = roundSpeakCounts.get(msg.personaId) ?? 0;
          roundSpeakCounts.set(msg.personaId, prev + 1);
        }
      }
    }
  }

  function startRound(question: string, participants: string[]): RoundState {
    currentRound = {
      roundId: `${now()}`,
      question,
      participants,
      startTime: now(),
    };
    // Reset round-local speak counts
    roundSpeakCounts = new Map<string, number>();
    for (const id of participants) { roundSpeakCounts.set(id, 0); }
    // Round-local emphasis bump for question terms
    updateTopicsFromText(question);
    return currentRound;
  }

  function selectFirstPanelist(candidates: string[]): string {
    // Prefer persona who hasn't spoken recently; tie-break by random
    const tsNow = now();
    let bestId = candidates[0];
    let bestScore = -Infinity;
    for (const id of candidates) {
      const last = lastSpokeAt.get(id) ?? 0;
      // Higher score if longer time since last spoke
      const idleSec = (tsNow - last) / 1000;
      const score = idleSec + Math.random() * 0.5; // small jitter
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    currentRound && (currentRound.firstSpeakerId = bestId);
    return bestId;
  }

  function getRollingHistory(): ContextMessage[] {
    pruneHistory();
    return [...history];
  }

  function getTopTopics(n = 6): string[] {
    const arr = [...topics.values()].sort((a, b) => b.weight - a.weight);
    return arr.slice(0, n).map(t => t.term);
  }

  function getRecentTensions(limit = 6): TensionPoint[] {
    return [...tensions].sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, limit);
  }

  function timeBudgetExceeded(): boolean {
    if (!currentRound) return false;
    return now() - currentRound.startTime > timeBudgetMsPerQuestion;
  }

  function buildPersonaSystemPrompt(
    basePersonaPrompt: string,
    personaId: string,
    personaName: string
  ): string {
    const topTopics = getTopTopics(6);
    const recentHistory = getRollingHistory()
      .filter(m => m.role === 'assistant')
      .slice(-6)
      .map(m => `${m.author || m.personaId || 'Assistant'}: ${short(m.text, 220)}`);

    const recentTension = getRecentTensions(4)
      .map(tp => `${tp.type === 'agreement' ? '✓ agrees' : '✕ disagrees'} between ${tp.between.join(' ↔ ')}${tp.quote ? ` (“${short(tp.quote, 80)}”)` : ''}`);

    const awareness = [
      topTopics.length ? `Current panel topics: ${topTopics.join(', ')}` : '',
      recentTension.length ? `Panel dynamics: ${recentTension.join(' | ')}` : '',
      recentHistory.length ? `Recent panel remarks:\n${recentHistory.join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    const flowControl = `
You are one panelist on a multi-persona panel. Answer the user's question succinctly with one or two new, high-signal points.
Avoid repeating yourself or others. If you would only repeat what's already been said, respond with exactly "SKIP".
Never enter circular back-and-forth; do not restate your credentials. Stay on-topic and practical.`;

    const panelDelivery = `
Professional panel delivery requirements:
- Respond as a professional panelist in a live discussion.
- Use complete, grammatically correct sentences and express complete thoughts (no fragments).
- Maintain a natural, conversational tone appropriate for a panel discussion.
- Avoid incomplete or truncated responses; never trail off.
- Minimize abbreviations or shorthand that a text-to-speech system may misread; prefer full words (e.g., say "Lieutenant" instead of "Lt.", "Professor" instead of "Prof.").`;

    const selfAwareness = `
Awareness for ${personaName}: If you previously spoke this round, avoid repeating your earlier points. Only add genuinely new content; otherwise reply "SKIP".`;

    const speakCount = currentRound ? (roundSpeakCounts.get(personaId) ?? 0) : 0;
    const isFollowup = speakCount >= 1;

    let followupEngagement = '';
    if (isFollowup && enforceEngagementOnFollowups) {
      let snippets: string[] = [];
      if (includeOtherSnippetsOnFollowups) {
        const inRoundOthers = getRollingHistory()
          .filter(m => m.role === 'assistant' && (!currentRound || m.timestamp >= (currentRound!.startTime)) && m.personaId !== personaId);
        const recent = inRoundOthers.slice(-Math.max(1, followupSnippetCount));
        snippets = recent.map(m => `${m.author || m.personaId || 'Assistant'}: ${short(m.text, 180)}`);
      }
      followupEngagement = `Follow-up turn for ${personaName}: You have already spoken once this round. In this turn, directly engage with other panelists: reference one or two of their points by name, add contrast or build on them, and introduce at least one new idea. If you cannot add new value, reply "SKIP".`
        + (snippets.length ? `\n\nSnippets from others to engage:\n${snippets.join('\n')}` : '');
    }

    return `${basePersonaPrompt}\n\n${flowControl}\n\n${panelDelivery}\n\n${selfAwareness}${followupEngagement ? '\n\n' + followupEngagement : ''}\n\n${awareness}`.trim();
  }

  function responseIsRepetitive(candidate: string, personaId: string): boolean {
    // Compare to that persona's most recent response using Jaccard overlap on keywords
    const lastMine = [...history].reverse().find(m => m.personaId === personaId && m.role === 'assistant');
    const candKw = extractKeywords(candidate);
    const a = new Set(candKw);

    let simSelf = 0;
    if (lastMine) {
      const b = new Set(extractKeywords(lastMine.text));
      simSelf = jaccard(a, b);
    }

    // Also compare to recent responses from other panelists (cross-persona duplication)
    const recentAssist = [...history].filter(m => m.role === 'assistant').slice(-8);
    const otherScoresFull = recentAssist
      .filter(m => m.personaId !== personaId)
      .map(m => ({
        personaId: m.personaId || m.author || 'unknown',
        score: jaccard(a, new Set(extractKeywords(m.text))),
        sample: short(m.text, 100),
      }))
      .sort((x, y) => y.score - x.score);

    const otherScores = otherScoresFull.slice(0, 3);
    const simOtherMax = otherScoresFull.length ? otherScoresFull[0].score : 0;

    try {
      console.log('🧪 [CE] repetition check', {
        personaId,
        simSelf: Number(simSelf.toFixed(3)),
        simOtherMax: Number(simOtherMax.toFixed(3)),
        threshold: 0.6,
        topOtherSimilarities: otherScores.map(o => ({ personaId: o.personaId, score: Number(o.score.toFixed(3)), sample: o.sample }))
      });
    } catch {}

    return simSelf >= 0.6 || simOtherMax >= 0.6; // high overlap with self or others => repetitive
  }

  function shouldConcludeRound(allInitialsCompleted: boolean): boolean {
    if (timeBudgetExceeded()) return true;
    // Simple rule: if everyone gave an initial answer and no new tensions emerged in the last ~30s
    if (allInitialsCompleted) {
      const thirtySecAgo = now() - 30_000;
      const recent = tensions.some(t => t.lastUpdated >= thirtySecAgo);
      return !recent; // conclude if calm and covered
    }
    return false;
  }


  function getSpeakCount(personaId: string): number {
    return currentRound ? (roundSpeakCounts.get(personaId) ?? 0) : 0;
  }

  function hasReachedTurnLimit(personaId: string): boolean {
    if (maxTurnsPerPersonaPerQuestion == null) return false;
    const c = getSpeakCount(personaId);
    return c >= maxTurnsPerPersonaPerQuestion;
  }

  return {
    config: { maxHistoryMessages, timeWindowMs, timeBudgetMsPerQuestion },
    ingestMessage,
    startRound,
    selectFirstPanelist,
    getRollingHistory,
    getTopTopics,
    getRecentTensions,
    timeBudgetExceeded,
    buildPersonaSystemPrompt,
    responseIsRepetitive,
    shouldConcludeRound,
    // New helpers
    getSpeakCount,
    hasReachedTurnLimit,
  };
}

