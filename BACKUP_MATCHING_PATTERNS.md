# Backup Question Matching Patterns - Quick Reference

## How to Trigger Pre-Generated Responses

This guide shows you exactly what to ask to get specific pre-generated backup responses.

## Matching Algorithm Summary

The system uses a **two-step matching process**:

1. **Title Word Matching** (30% threshold)
   - Splits demo question titles into words
   - Counts how many words appear in your question
   - If >30% match, uses that response

2. **Keyword Pattern Matching**
   - Checks for specific keyword combinations
   - More targeted than title matching
   - Catches questions that don't match titles well

## Available Pre-Generated Responses

### Q1: Technical Bottlenecks in LLM+GeoAI Integration

**File**: `q1-technical-bottlenecks.json`

**Title Words**: technical, bottlenecks, in, llm+geoai, integration

**Keyword Patterns**:
- Contains "bottleneck" OR
- Contains "integration"

**Example Questions That Match**:
- ✅ "What are the technical bottlenecks?"
- ✅ "Tell me about integration challenges"
- ✅ "What bottlenecks do you see?"
- ✅ "How do you handle LLM integration?"
- ✅ "What are the biggest technical challenges in integration?"

**Example Questions That DON'T Match**:
- ❌ "What are the challenges?" (no specific keywords)
- ❌ "Tell me about problems" (different terminology)

**Actual Pre-Generated Question**:
> "When you integrate an open-source LLM like Llama or Mistral with geospatial workflows—say, for automated feature extraction from satellite imagery—what are the three biggest technical bottlenecks you encounter, and how do you solve them?"

---

### Q2: Model Selection for LIDAR Processing

**File**: `q2-model-selection.json`

**Title Words**: model, selection, for, lidar, processing

**Keyword Patterns**:
- Contains "model" AND (contains "select" OR contains "lidar")

**Example Questions That Match**:
- ✅ "How do I select a model for LIDAR?"
- ✅ "What model should I use for LIDAR processing?"
- ✅ "Tell me about model selection"
- ✅ "Which model works best for LIDAR?"
- ✅ "How do you choose models for processing?"

**Example Questions That DON'T Match**:
- ❌ "What model do you use?" (missing "select" or "lidar")
- ❌ "Tell me about LIDAR" (missing "model")

**Actual Pre-Generated Question**:
> "How do you select models for LIDAR processing?"

---

### Q3: Data Sovereignty Architecture

**File**: `q3-data-sovereignty.json`

**Title Words**: data, sovereignty, architecture

**Keyword Patterns**:
- Contains "sovereignty" OR
- Contains "data privacy"

**Example Questions That Match**:
- ✅ "How do you handle data sovereignty?"
- ✅ "Tell me about data privacy concerns"
- ✅ "What's your approach to sovereignty?"
- ✅ "How do you ensure data privacy?"
- ✅ "What architecture supports data sovereignty?"

**Example Questions That DON'T Match**:
- ❌ "How do you protect data?" (use "privacy" instead)
- ❌ "Tell me about security" (different concept)

**Actual Pre-Generated Question**:
> "What's the best architecture for data sovereignty?"

---

### Q4: Community PostGIS LLM Development

**File**: `q4-community-model.json`

**Title Words**: community, postgis, llm, development

**Keyword Patterns**:
- Contains "community" OR
- Contains "postgis"

**Example Questions That Match**:
- ✅ "How can we build a community model?"
- ✅ "Tell me about PostGIS integration"
- ✅ "What about community-driven development?"
- ✅ "How do you use PostGIS with LLMs?"
- ✅ "Can we develop a community PostGIS solution?"

**Example Questions That DON'T Match**:
- ❌ "How do we build open-source tools?" (use "community" instead)
- ❌ "Tell me about spatial databases" (use "postgis" specifically)

**Actual Pre-Generated Question**:
> "How can we develop a community PostGIS LLM?"

---

### Q5: Debugging Complex Geometry Processing

**File**: `q5-debugging-approach.json`

**Title Words**: debugging, complex, geometry, processing

**Keyword Patterns**:
- Contains "debug" OR
- Contains "geometry"

**Example Questions That Match**:
- ✅ "How do you debug geometry issues?"
- ✅ "What's your debugging approach?"
- ✅ "Tell me about geometry processing problems"
- ✅ "How do you troubleshoot geometry?"
- ✅ "What's your approach to debugging complex issues?"

**Example Questions That DON'T Match**:
- ❌ "How do you fix errors?" (use "debug" instead)
- ❌ "Tell me about troubleshooting" (use "debug" instead)

**Actual Pre-Generated Question**:
> "What's your approach to debugging geometry processing?"

---

### Q6: Future Architecture Evolution

**File**: `q6-future-architecture.json`

**Title Words**: future, architecture, evolution

**Keyword Patterns**:
- Contains "future" OR
- Contains "architecture"

**Example Questions That Match**:
- ✅ "How will architecture evolve in the future?"
- ✅ "What's the future of geospatial AI?"
- ✅ "Tell me about future trends"
- ✅ "What architecture should we use?"
- ✅ "How do you see the future developing?"

**Example Questions That DON'T Match**:
- ❌ "What's coming next?" (use "future" instead)
- ❌ "Tell me about trends" (use "future" instead)

**Actual Pre-Generated Question**:
> "How will geospatial AI architecture evolve?"

---

## Matching Algorithm Details

### Title Word Matching (Step 1)

**Algorithm**:
```javascript
1. Convert your question to lowercase
2. For each demo question:
   a. Split title into words
   b. Count how many title words appear in your question
   c. Calculate: matchCount / totalWords
   d. If ratio > 0.3 (30%), return that question ID
3. If no match, proceed to Step 2
```

**Example**:
```
Your question: "What are the technical bottlenecks in integration?"
Demo title: "Technical Bottlenecks in LLM+GeoAI Integration"

Title words: ["technical", "bottlenecks", "in", "llm+geoai", "integration"]
Matches found: ["technical", "bottlenecks", "in", "integration"] = 4 words
Match ratio: 4/5 = 80% > 30% ✅ MATCH!
```

### Keyword Pattern Matching (Step 2)

**Algorithm**:
```javascript
1. Check if question contains specific keyword combinations
2. Return first matching question ID
3. If no patterns match, return null (→ generic fallback)
```

**Pattern Priority** (checked in order):
1. bottleneck OR integration → q1
2. model AND (select OR lidar) → q2
3. sovereignty OR data privacy → q3
4. community OR postgis → q4
5. debug OR geometry → q5
6. future OR architecture → q6

---

## Tips for Getting Specific Responses

### ✅ DO:
- Use specific keywords from the patterns above
- Include multiple relevant words (increases match probability)
- Use exact terminology (e.g., "PostGIS" not "spatial database")
- Ask about specific topics (e.g., "bottlenecks" not "problems")

### ❌ DON'T:
- Use vague terms (e.g., "issues", "things", "stuff")
- Use synonyms that aren't in the patterns (e.g., "troubles" instead of "debug")
- Ask overly general questions (e.g., "Tell me about AI")
- Mix multiple topics in one question (may match wrong response)

---

## Testing the Matching System

### Quick Test Procedure

1. **Set backup mode to "Always"** in Settings
2. **Ask a test question** from the examples above
3. **Check the console** for matching logs:
   ```
   📦 Backup mode active - using pre-generated response
   📦 Found matching backup question: q1-technical-bottlenecks
   ✅ Using pre-generated backup response for marcus
   ```
4. **Verify the response** matches the expected topic

### Console Logs to Watch For

**Successful Match**:
```
📦 Found matching backup question: q2-model-selection
✅ Using pre-generated backup response for sarah
```

**Generic Fallback**:
```
📦 Using generic fallback response for maya
```

**No Backup Available**:
```
❌ Error getting backup response: [error details]
```

---

## Generic Fallback Responses

If your question doesn't match any patterns, you'll get a **persona-specific generic response**:

- **Maya**: Emphasizes community-centered approaches and Indigenous data governance
- **Otto**: Focuses on mathematical rigor and spatial reference standards
- **Sarah**: Highlights open-source, transparent, community-driven solutions
- **Marcus**: Stresses production reliability, security, and measurable results
- **Jessica**: Emphasizes national security, data protection, and operational readiness

These are still useful responses, just not specific to any demo topic.

---

## Customizing Matching Patterns

Want to add your own patterns? Edit `src/services/backup-loader.ts`:

```typescript
// Add to findMatchingBackupQuestion function
if (lowerQuestion.includes('your-keyword') || lowerQuestion.includes('another-keyword')) {
  return 'your-question-id';
}
```

Then create a corresponding JSON file in `public/demo-backup/your-question-id.json`.

---

## Summary Table

| Question ID | Primary Keywords | Secondary Keywords | Match Threshold |
|-------------|------------------|-------------------|-----------------|
| q1-technical-bottlenecks | bottleneck, integration | technical | 30% title match |
| q2-model-selection | model + (select OR lidar) | processing | 30% title match |
| q3-data-sovereignty | sovereignty, data privacy | architecture | 30% title match |
| q4-community-model | community, postgis | llm, development | 30% title match |
| q5-debugging-approach | debug, geometry | processing | 30% title match |
| q6-future-architecture | future, architecture | evolution | 30% title match |

---

## Need Help?

If you're not getting the expected matches:

1. **Check the console logs** to see what's being matched
2. **Try more specific keywords** from the patterns above
3. **Use exact terminology** (e.g., "PostGIS" not "postgres")
4. **Test with example questions** from this guide first
5. **Review the matching algorithm** in `src/services/backup-loader.ts`

The matching system is designed to be flexible but specific enough to avoid false matches. When in doubt, use the exact keywords from the patterns above!

