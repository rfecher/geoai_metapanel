# Hybrid Mode Matching Reference - Quick Guide

## Confidence Thresholds

| Threshold | Meaning | Action in Hybrid Mode |
|-----------|---------|----------------------|
| **0.95** | Very strong match (exact introduction phrases) | Use pre-generated response |
| **0.85** | Strong match (multi-keyword patterns) | Use pre-generated response |
| **0.75** | Good match (weaker introduction phrases) | Use pre-generated response |
| **0.50-0.74** | Weak match (partial title match) | Use live LLM |
| **0.00** | No match | Use live LLM |

**Hybrid Mode Rule**: Only use pre-generated response if confidence ≥ 0.75

---

## Introduction Matching

### Strong Patterns (Confidence: 0.95)

These phrases trigger pre-generated introductions with highest confidence:

✅ **"introduce yourself"**  
✅ **"who are you"**  
✅ **"tell me about yourself"**

**Example Questions**:
- "Can you introduce yourself?"
- "Who are you?"
- "Please tell me about yourself"

**Result**: Pre-generated introduction from `introduction.json`

---

### Weaker Patterns (Confidence: 0.75)

These phrases also trigger introductions but with lower confidence:

✅ "introduce your"  
✅ "who is"  
✅ "tell me about your"  
✅ "what is your background"  
✅ "what's your background"  
✅ "your background"  
✅ "what do you do"  
✅ "your experience"  
✅ "your role"  
✅ "about you"

**Example Questions**:
- "Tell me about your background"
- "What do you do?"
- "What's your experience?"

**Result**: Pre-generated introduction from `introduction.json`

---

## Demo Question Matching (q1-q6)

### Q1: Technical Bottlenecks in LLM+GeoAI Integration

**Required Keywords**: `bottleneck` AND (`integration` OR `technical` OR `llm` OR `geoai`)

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "What are the **technical bottlenecks**?"
- "Tell me about **bottlenecks** in **LLM integration**"
- "What **bottlenecks** do you see in **GeoAI**?"
- "Explain the **integration bottlenecks**"

**❌ Weak Matches** (use live LLM):
- "What are the bottlenecks?" (missing second keyword)
- "Tell me about integration" (missing "bottleneck")
- "What challenges exist?" (different terminology)

---

### Q2: Model Selection for LIDAR Processing

**Required Keywords**: `model` AND (`select` OR `lidar`) AND (`processing` OR `choose` OR `which`)

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "**Which model** should I **select** for **processing**?"
- "How do I **choose** a **model** for **LIDAR**?"
- "**Model selection** for **LIDAR processing**"
- "**Which model** works best for **LIDAR**?"

**❌ Weak Matches** (use live LLM):
- "Tell me about model selection" (missing third keyword)
- "Which model should I use?" (missing "select/lidar" and "processing/choose/which")
- "How do I select a LIDAR?" (missing "model")

---

### Q3: Data Sovereignty Architecture

**Required Keywords**: `sovereignty` OR (`data` AND `privacy` AND (`architecture` OR `governance`))

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "How do you handle **data sovereignty**?"
- "What's the **data privacy architecture**?"
- "Tell me about **data privacy governance**"
- "Explain your **sovereignty** approach"

**❌ Weak Matches** (use live LLM):
- "Tell me about data privacy" (missing "architecture/governance")
- "How do you protect data?" (different terminology)
- "What about privacy?" (missing "data" and "architecture/governance")

---

### Q4: Community PostGIS LLM Development

**Required Keywords**: (`community` OR `postgis`) AND (`llm` OR `model` OR `development`)

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "How can we build a **community model**?"
- "What about **PostGIS LLM development**?"
- "Tell me about **community** **LLM** efforts"
- "**PostGIS model development**"

**❌ Weak Matches** (use live LLM):
- "Tell me about the community" (missing second keyword)
- "What is PostGIS?" (missing "llm/model/development")
- "How do we develop tools?" (missing "community/postgis")

---

### Q5: Debugging Complex Geometry Processing

**Required Keywords**: (`debug` OR `debugging`) AND (`geometry` OR `processing` OR `spatial`)

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "How do you **debug geometry** issues?"
- "What's your **debugging** approach for **spatial** data?"
- "**Debug geometry processing** problems"
- "**Debugging spatial** workflows"

**❌ Weak Matches** (use live LLM):
- "How do you debug?" (missing second keyword)
- "Tell me about geometry" (missing "debug/debugging")
- "What about troubleshooting?" (different terminology)

---

### Q6: Future Architecture Evolution

**Required Keywords**: `future` AND (`architecture` OR `evolution` OR `trends`)

**Confidence**: 0.85

**✅ Strong Matches** (use pre-generated):
- "How will **architecture** evolve in the **future**?"
- "What are **future trends** in **architecture**?"
- "Tell me about **future** **evolution**"
- "**Future architecture** plans"

**❌ Weak Matches** (use live LLM):
- "Tell me about the future" (missing second keyword)
- "What about architecture?" (missing "future")
- "What's coming next?" (different terminology)

---

## Title Word Matching

**Threshold**: 50% of title words must appear in question

**Confidence**: min(0.9, matchRatio)

**Example**:

```
Question: "What are the technical bottlenecks in LLM integration?"
Title: "Technical Bottlenecks in LLM+GeoAI Integration"
Words: ["technical", "bottlenecks", "in", "llm+geoai", "integration"]

Matched words: ["technical", "bottlenecks", "integration"] = 3 words
Match ratio: 3/5 = 60%

60% >= 50% threshold? ✅ Yes
Confidence: min(0.9, 0.6) = 0.6

Hybrid mode check: 0.6 < 0.75 ❌
Result: Use live LLM (confidence too low)
```

**Note**: Title matching alone rarely reaches 0.75 threshold. Keyword matching is more reliable for hybrid mode.

---

## Testing Cheat Sheet

### Questions That Should Use Pre-Generated Responses

| Question | Matches | Confidence | Result |
|----------|---------|-----------|--------|
| "Who are you?" | Introduction (strong) | 0.95 | ✅ Backup |
| "Introduce yourself" | Introduction (strong) | 0.95 | ✅ Backup |
| "What's your background?" | Introduction (weak) | 0.75 | ✅ Backup |
| "What are the technical bottlenecks in integration?" | Q1 (keyword) | 0.85 | ✅ Backup |
| "Which model should I select for LIDAR processing?" | Q2 (keyword) | 0.85 | ✅ Backup |
| "How do you handle data sovereignty?" | Q3 (keyword) | 0.85 | ✅ Backup |
| "How can we build a community LLM?" | Q4 (keyword) | 0.85 | ✅ Backup |
| "How do you debug geometry processing?" | Q5 (keyword) | 0.85 | ✅ Backup |
| "What are future architecture trends?" | Q6 (keyword) | 0.85 | ✅ Backup |

### Questions That Should Use Live LLM

| Question | Why No Match | Confidence | Result |
|----------|--------------|-----------|--------|
| "What are some challenges?" | No specific keywords | 0.0 | ❌ Live LLM |
| "Tell me about bottlenecks" | Missing second keyword | 0.0 | ❌ Live LLM |
| "How do you debug?" | Missing second keyword | 0.0 | ❌ Live LLM |
| "What about the future?" | Missing second keyword | 0.0 | ❌ Live LLM |
| "Tell me about data privacy" | Missing architecture/governance | 0.0 | ❌ Live LLM |
| "What is PostGIS?" | Missing llm/model/development | 0.0 | ❌ Live LLM |
| "How do you handle errors?" | Different terminology | 0.0 | ❌ Live LLM |
| "What's your opinion on AI?" | No matching pattern | 0.0 | ❌ Live LLM |

---

## Console Log Patterns

### Pre-Generated Response Used

```
🔀 Hybrid mode: Strong match detected - using pre-generated response
📦 Found matching backup question: q1-technical-bottlenecks
✅ Using pre-generated backup response for marcus
```

### Live LLM Used

```
🔀 Hybrid mode: Weak/no match - using live LLM
```

---

## Quick Decision Tree

```
Is question asking for introduction?
├─ Yes, strong pattern (who are you, etc.)
│  └─ Confidence: 0.95 → Use backup ✅
├─ Yes, weak pattern (your background, etc.)
│  └─ Confidence: 0.75 → Use backup ✅
└─ No
   └─ Does question contain multiple specific keywords for q1-q6?
      ├─ Yes
      │  └─ Confidence: 0.85 → Use backup ✅
      └─ No
         └─ Does question have 50%+ title word match?
            ├─ Yes
            │  └─ Confidence: 0.5-0.9 → Usually < 0.75 → Use live LLM ❌
            └─ No
               └─ Confidence: 0.0 → Use live LLM ❌
```

---

## Summary

**Hybrid mode is conservative by design:**

- ✅ **Uses backup** only for clear, strong matches (confidence ≥ 0.75)
- ❌ **Uses live LLM** for everything else (weak matches, general conversation)
- 🎯 **Best for**: Demo presentations + natural conversation
- 📊 **Threshold**: 0.75 confidence minimum for backup responses

**Key Principle**: When in doubt, use the live LLM. Pre-generated responses are reserved for specific demo topics with strong keyword matches.

