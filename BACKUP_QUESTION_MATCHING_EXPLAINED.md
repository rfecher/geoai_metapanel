# Backup System Question Matching - Detailed Explanation

## Overview

This document explains exactly how the backup/fallback system matches your questions to pre-generated responses, with code examples from the actual implementation.

## The Complete Flow: From Question to Response

### 1. **Question Submission** (App.tsx)

When you submit a question, it goes through the chat handler with the persona ID:

<augment_code_snippet path="src/App.tsx" mode="EXCERPT">
````typescript
// Line 795, 818, 902, 962, 1014 - All LLM calls include personaId
const response = await chatWithLLM(llmConfig, {
  model: modelToUse,
  messages: chatMessages,
  personaId: p.id  // ← This is crucial for backup matching!
});
````
</augment_code_snippet>

**Key Point**: The `personaId` (e.g., "maya", "marcus", "sarah") is passed along with your question so the backup system knows which persona's response to retrieve.

---

### 2. **Question Extraction** (llm.ts)

Before checking backups, the system extracts your actual question from the message history:

<augment_code_snippet path="src/services/llm.ts" mode="EXCERPT">
````typescript
// Lines 54-61
function extractUserQuestion(messages: ChatMessage[]): string {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  return '';
}
````
</augment_code_snippet>

**Example**: If your message history is:
```javascript
[
  { role: 'system', content: 'You are Maya...' },
  { role: 'user', content: 'What are the bottlenecks in LLM integration?' },
  { role: 'assistant', content: 'Previous response...' },
  { role: 'user', content: 'Tell me more about data sovereignty' }  // ← This is extracted
]
```

The function returns: `"Tell me more about data sovereignty"`

---

### 3. **Backup Mode Check** (llm.ts)

The LLM service checks if backup mode is active:

<augment_code_snippet path="src/services/llm.ts" mode="EXCERPT">
````typescript
// Lines 73-77
if (shouldUseBackup() && req.personaId) {
  console.log('📦 Backup mode active - using pre-generated response');
  const userQuestion = extractUserQuestion(req.messages);
  return await getBackupResponseWithFallback(userQuestion, req.personaId, false);
}
````
</augment_code_snippet>

**When is backup mode active?**
- Mode is set to "always", OR
- Mode is "auto" AND 2+ consecutive LLM failures occurred

---

### 4. **Question Matching Algorithm** (backup-loader.ts)

This is the heart of the system! The `findMatchingBackupQuestion()` function uses a **two-step matching process**:

<augment_code_snippet path="src/services/backup-loader.ts" mode="EXCERPT">
````typescript
// Lines 46-81
export const findMatchingBackupQuestion = (userQuestion: string): string | null => {
  const lowerQuestion = userQuestion.toLowerCase();

  // STEP 1: Title word matching (30% threshold)
  for (const demoQ of DEMO_QUESTIONS) {
    const keywords = demoQ.title.toLowerCase().split(/\s+/);
    const matchCount = keywords.filter(keyword => lowerQuestion.includes(keyword)).length;

    // If more than 30% of keywords match, consider it a match
    if (matchCount / keywords.length > 0.3) {
      return demoQ.id;
    }
  }

  // STEP 2: Topic-specific keyword patterns
  if (lowerQuestion.includes('bottleneck') || lowerQuestion.includes('integration')) {
    return 'q1-technical-bottlenecks';
  }
  if (lowerQuestion.includes('model') && (lowerQuestion.includes('select') || lowerQuestion.includes('lidar'))) {
    return 'q2-model-selection';
  }
  // ... more patterns ...
  
  return null; // No match found
};
````
</augment_code_snippet>

#### Step 1: Title Word Matching (30% Threshold)

**How it works:**
1. Convert your question to lowercase
2. For each demo question, split its title into words
3. Count how many title words appear in your question
4. If >30% of title words match, return that question ID

**Example 1**: Your question: "What are the technical bottlenecks?"

```javascript
Demo question title: "Technical Bottlenecks in LLM+GeoAI Integration"
Title words: ["technical", "bottlenecks", "in", "llm+geoai", "integration"]
Matches in your question: ["technical", "bottlenecks"] = 2 matches
Match percentage: 2/5 = 40% > 30% ✅ MATCH!
Returns: "q1-technical-bottlenecks"
```

**Example 2**: Your question: "How do I select the right model for LIDAR?"

```javascript
Demo question title: "Model Selection for LIDAR Processing"
Title words: ["model", "selection", "for", "lidar", "processing"]
Matches in your question: ["model", "select" (partial), "lidar"] = 3 matches
Match percentage: 3/5 = 60% > 30% ✅ MATCH!
Returns: "q2-model-selection"
```

#### Step 2: Topic-Specific Keyword Patterns

If Step 1 doesn't find a match, the system checks for specific keyword combinations:

**Pattern Examples:**

| Your Question Contains | Returns |
|------------------------|---------|
| "bottleneck" OR "integration" | q1-technical-bottlenecks |
| "model" AND ("select" OR "lidar") | q2-model-selection |
| "sovereignty" OR "data privacy" | q3-data-sovereignty |
| "community" OR "postgis" | q4-community-model |
| "debug" OR "geometry" | q5-debugging-approach |
| "future" OR "architecture" | q6-future-architecture |

**Example**: Your question: "How do we handle data sovereignty?"
- Contains "sovereignty" → Returns `q3-data-sovereignty`

---

### 5. **Loading the Backup Response** (backup.ts)

Once a question ID is found, the system loads the corresponding JSON file:

<augment_code_snippet path="src/services/backup.ts" mode="EXCERPT">
````typescript
// Lines 117-142
export async function getBackupResponse(
  question: string,
  personaId: string
): Promise<string | null> {
  try {
    // Find matching question ID
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
````
</augment_code_snippet>

**What happens:**
1. `findMatchingBackupQuestion("What are the bottlenecks?")` → Returns `"q1-technical-bottlenecks"`
2. `loadBackupResponses("q1-technical-bottlenecks")` → Fetches `/demo-backup/q1-technical-bottlenecks.json`
3. Extract response for the specific persona: `backupData.responses["maya"].content`

**JSON Structure:**
```json
{
  "question": "When you integrate an open-source LLM...",
  "responses": {
    "maya": {
      "content": "First bottleneck is data preprocessing...",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    "otto": { "content": "...", "timestamp": "..." },
    "sarah": { "content": "...", "timestamp": "..." },
    "marcus": { "content": "...", "timestamp": "..." },
    "jessica": { "content": "...", "timestamp": "..." }
  }
}
```

---

### 6. **Generic Fallback** (backup-loader.ts)

If no matching question is found, the system uses persona-specific generic responses:

<augment_code_snippet path="src/services/backup-loader.ts" mode="EXCERPT">
````typescript
// Lines 86-96
export const getGenericFallbackResponse = (personaId: string): string => {
  const genericResponses: Record<string, string> = {
    maya: "I appreciate the question. From my experience in emergency response...",
    otto: "An interesting question indeed. From a cartographic perspective...",
    sarah: "Great question! From an open-source perspective...",
    marcus: "Good question. In my experience deploying geospatial AI systems...",
    jessica: "That's a critical question for national security applications..."
  };

  return genericResponses[personaId] || "Thank you for the question...";
};
````
</augment_code_snippet>

**When this is used:**
- Your question doesn't match any demo topics
- Example: "What's the weather like?" → No match → Generic response

---

### 7. **Streaming Simulation** (backup.ts)

For streaming mode, the backup response is delivered word-by-word:

<augment_code_snippet path="src/services/backup.ts" mode="EXCERPT">
````typescript
// Lines 148-165
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
````
</augment_code_snippet>

**Example**: Response: "First bottleneck is data preprocessing"
- Chunk 1: "First" (wait 30ms)
- Chunk 2: " bottleneck" (wait 30ms)
- Chunk 3: " is" (wait 30ms)
- Chunk 4: " data" (wait 30ms)
- Chunk 5: " preprocessing" (done)

This creates a natural typing effect just like live LLM streaming!

---

## Complete Example Walkthrough

Let's trace a complete example from start to finish:

### Scenario: You ask "What are the integration bottlenecks?"

**Step 1**: Question submitted with personaId = "marcus"

**Step 2**: Extract question
```javascript
extractUserQuestion(messages) → "What are the integration bottlenecks?"
```

**Step 3**: Check backup mode
```javascript
shouldUseBackup() → true (mode is "always" or auto-enabled)
```

**Step 4**: Match question
```javascript
findMatchingBackupQuestion("What are the integration bottlenecks?")

// Step 1: Title matching
Title: "Technical Bottlenecks in LLM+GeoAI Integration"
Words: ["technical", "bottlenecks", "in", "llm+geoai", "integration"]
Matches: ["bottlenecks", "integration"] = 2/5 = 40% > 30% ✅

Returns: "q1-technical-bottlenecks"
```

**Step 5**: Load backup
```javascript
loadBackupResponses("q1-technical-bottlenecks")
→ Fetches /demo-backup/q1-technical-bottlenecks.json
→ Returns JSON with all persona responses
```

**Step 6**: Extract Marcus's response
```javascript
backupData.responses["marcus"].content
→ "Throughput optimization is essential for production systems—we've implemented batch processing..."
```

**Step 7**: Stream or return
```javascript
// If streaming mode:
streamBackupResponse(response, onChunk, 30)
→ Sends words progressively with 30ms delays

// If non-streaming:
return response
→ Returns complete response immediately
```

**Step 8**: Display in UI
- Marcus's avatar shows the response
- TTS speaks the response
- Message appears in chat history

---

## Matching Examples

### Example 1: Direct Match
**Your question**: "What are the technical bottlenecks in LLM integration?"
- **Matches**: q1-technical-bottlenecks (title word matching: 60%)
- **Result**: Pre-generated response about bottlenecks

### Example 2: Keyword Match
**Your question**: "How do I debug geometry issues?"
- **Matches**: q5-debugging-approach (keyword: "debug" + "geometry")
- **Result**: Pre-generated response about debugging

### Example 3: Partial Match
**Your question**: "Tell me about future trends"
- **Matches**: q6-future-architecture (keyword: "future")
- **Result**: Pre-generated response about architecture evolution

### Example 4: No Match
**Your question**: "What's your favorite color?"
- **Matches**: None
- **Result**: Generic fallback response for the persona

---

## Key Takeaways

1. **Question extraction** pulls your last user message from the conversation history
2. **Two-step matching** tries title word matching (30% threshold) first, then specific keywords
3. **Persona-specific responses** ensure each expert provides their unique perspective
4. **Generic fallbacks** handle questions that don't match any demo topics
5. **Streaming simulation** makes backup responses feel natural and live
6. **Automatic recovery** returns to live LLM when it becomes available again

The system is designed to be **transparent** (you can see when backup mode is active), **reliable** (always provides a response), and **natural** (streaming makes it feel like live AI).

