# Backup System Data Flow - Concrete Example

This document traces a **real example** through the entire backup system, showing the actual data at each step.

## Example Scenario

**User**: Asks "What are the integration bottlenecks?"  
**Persona**: Marcus  
**Backup Mode**: Always (for demonstration)  
**Streaming**: Enabled

---

## Step-by-Step Data Flow

### Step 1: User Submits Question

**Location**: `src/App.tsx` (line ~795)

**Input Data**:
```javascript
{
  userInput: "What are the integration bottlenecks?",
  selectedPersonas: [
    { id: "marcus", name: "Marcus Chen", ... }
  ]
}
```

**Code Executed**:
```typescript
const response = await chatWithLLMStreaming(
  llmConfig,
  {
    model: "llama3.2:latest",
    messages: [
      { role: "system", content: "You are Marcus Chen, a Senior Solutions Architect..." },
      { role: "user", content: "What are the integration bottlenecks?" }
    ],
    personaId: "marcus"  // ← Key data point!
  },
  (chunk) => { /* handle streaming chunk */ }
);
```

**Output**: Calls `chatWithLLMStreaming()` with personaId

---

### Step 2: Check Backup Mode

**Location**: `src/services/llm.ts` (line 127)

**Input Data**:
```javascript
{
  personaId: "marcus",
  messages: [
    { role: "system", content: "You are Marcus Chen..." },
    { role: "user", content: "What are the integration bottlenecks?" }
  ]
}
```

**Code Executed**:
```typescript
if (shouldUseBackup() && req.personaId) {
  console.log('📦 Backup mode active - using pre-generated response with streaming simulation');
  const userQuestion = extractUserQuestion(req.messages);
  return await getBackupResponseWithFallback(userQuestion, req.personaId, true, onChunk);
}
```

**Function Call**: `shouldUseBackup()`

**Location**: `src/services/backup.ts` (line 109)

```typescript
export function shouldUseBackup(): boolean {
  return backupConfig.mode === 'always' || backupConfig.enabled;
  // Returns: true (mode is 'always')
}
```

**Output**: Backup mode is active → proceed to extract question

---

### Step 3: Extract User Question

**Location**: `src/services/llm.ts` (line 129)

**Input Data**:
```javascript
messages: [
  { role: "system", content: "You are Marcus Chen, a Senior Solutions Architect..." },
  { role: "user", content: "What are the integration bottlenecks?" }
]
```

**Code Executed**:
```typescript
function extractUserQuestion(messages: ChatMessage[]): string {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  return '';
}
```

**Processing**:
```
i = 1: messages[1].role = "user" ✅
Return: messages[1].content
```

**Output**: `"What are the integration bottlenecks?"`

---

### Step 4: Get Backup Response with Fallback

**Location**: `src/services/backup.ts` (line 171)

**Input Data**:
```javascript
{
  question: "What are the integration bottlenecks?",
  personaId: "marcus",
  streaming: true,
  onChunk: function(chunk) { /* callback */ }
}
```

**Code Executed**:
```typescript
export async function getBackupResponseWithFallback(
  question: string,
  personaId: string,
  streaming: boolean = false,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const response = await getBackupResponse(question, personaId);
  
  if (streaming && onChunk) {
    await streamBackupResponse(response, onChunk);
  }
  
  return response;
}
```

**Output**: Calls `getBackupResponse()`

---

### Step 5: Find Matching Question

**Location**: `src/services/backup.ts` (line 123)

**Input Data**:
```javascript
{
  question: "What are the integration bottlenecks?",
  personaId: "marcus"
}
```

**Code Executed**:
```typescript
const matchingQuestionId = findMatchingBackupQuestion(question);
```

**Function Call**: `findMatchingBackupQuestion()`

**Location**: `src/services/backup-loader.ts` (line 46)

**Processing**:

```javascript
// Input
userQuestion = "What are the integration bottlenecks?"
lowerQuestion = "what are the integration bottlenecks?"

// Step 1: Title word matching
DEMO_QUESTIONS[0] = {
  id: 'q1-technical-bottlenecks',
  title: 'Technical Bottlenecks in LLM+GeoAI Integration'
}

keywords = ["technical", "bottlenecks", "in", "llm+geoai", "integration"]

// Check each keyword
"technical" in lowerQuestion? → false
"bottlenecks" in lowerQuestion? → true ✅
"in" in lowerQuestion? → false
"llm+geoai" in lowerQuestion? → false
"integration" in lowerQuestion? → true ✅

matchCount = 2
keywords.length = 5
ratio = 2/5 = 0.4 = 40%

// Check threshold
0.4 > 0.3? → true ✅

// Return match!
return 'q1-technical-bottlenecks'
```

**Console Output**:
```
📦 Found matching backup question: q1-technical-bottlenecks
```

**Output**: `"q1-technical-bottlenecks"`

---

### Step 6: Load Backup Responses

**Location**: `src/services/backup.ts` (line 127)

**Input Data**:
```javascript
matchingQuestionId = "q1-technical-bottlenecks"
```

**Code Executed**:
```typescript
const backupData = await loadBackupResponses(matchingQuestionId);
```

**Function Call**: `loadBackupResponses()`

**Location**: `src/services/backup-loader.ts` (line 19)

```typescript
export const loadBackupResponses = async (questionId: string): Promise<BackupQuestion | null> => {
  try {
    const response = await fetch(`/demo-backup/${questionId}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to load backup responses for ${questionId}:`, error);
    return null;
  }
};
```

**HTTP Request**:
```
GET /demo-backup/q1-technical-bottlenecks.json
```

**Response Data** (parsed JSON):
```json
{
  "question": "When you integrate an open-source LLM like Llama or Mistral with geospatial workflows—say, for automated feature extraction from satellite imagery—what are the three biggest technical bottlenecks you encounter, and how do you solve them?",
  "responses": {
    "maya": {
      "content": "First bottleneck is data preprocessing—LLMs expect text but satellite imagery needs feature encoding through vision transformers or CNN embeddings first. Second is context window limitations when processing large raster datasets; we chunk spatially and use sliding windows with overlap buffers. Third is inference latency; running Llama 70B locally for real-time analysis requires model quantization to 4-bit and GPU memory optimization, or we fall back to smaller models like Mistral 7B with acceptable accuracy trade-offs.",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    "otto": { "content": "...", "timestamp": "..." },
    "sarah": { "content": "...", "timestamp": "..." },
    "marcus": {
      "content": "Throughput optimization is essential for production systems—we've implemented batch processing with dynamic batching algorithms that group similar spatial queries to maximize GPU utilization. Error handling becomes complex when LLMs hallucinate spatial relationships; we use confidence scoring and geometric validation to filter unreliable outputs. The third bottleneck is model fine-tuning for domain-specific geospatial terminology; we maintain curated datasets of spatial feature descriptions and use LoRA adapters to specialize base models without full retraining overhead.",
      "timestamp": "2024-01-15T10:00:15Z"
    },
    "jessica": { "content": "...", "timestamp": "..." }
  }
}
```

**Output**: Full backup data object

---

### Step 7: Extract Persona Response

**Location**: `src/services/backup.ts` (line 129)

**Input Data**:
```javascript
{
  backupData: { /* full JSON object from above */ },
  personaId: "marcus"
}
```

**Code Executed**:
```typescript
if (backupData && backupData.responses[personaId]) {
  console.log(`✅ Using pre-generated backup response for ${personaId}`);
  return backupData.responses[personaId].content;
}
```

**Processing**:
```javascript
backupData.responses["marcus"] = {
  content: "Throughput optimization is essential for production systems—we've implemented batch processing with dynamic batching algorithms that group similar spatial queries to maximize GPU utilization. Error handling becomes complex when LLMs hallucinate spatial relationships; we use confidence scoring and geometric validation to filter unreliable outputs. The third bottleneck is model fine-tuning for domain-specific geospatial terminology; we maintain curated datasets of spatial feature descriptions and use LoRA adapters to specialize base models without full retraining overhead.",
  timestamp: "2024-01-15T10:00:15Z"
}

return backupData.responses["marcus"].content
```

**Console Output**:
```
✅ Using pre-generated backup response for marcus
```

**Output**: Marcus's full response text (string)

---

### Step 8: Stream the Response

**Location**: `src/services/backup.ts` (line 190)

**Input Data**:
```javascript
{
  response: "Throughput optimization is essential for production systems—we've implemented batch processing with dynamic batching algorithms that group similar spatial queries to maximize GPU utilization. Error handling becomes complex when LLMs hallucinate spatial relationships; we use confidence scoring and geometric validation to filter unreliable outputs. The third bottleneck is model fine-tuning for domain-specific geospatial terminology; we maintain curated datasets of spatial feature descriptions and use LoRA adapters to specialize base models without full retraining overhead.",
  onChunk: function(chunk) { /* callback */ },
  streaming: true
}
```

**Code Executed**:
```typescript
if (streaming && onChunk) {
  await streamBackupResponse(response, onChunk);
}
```

**Function Call**: `streamBackupResponse()`

**Location**: `src/services/backup.ts` (line 148)

```typescript
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
```

**Processing**:
```javascript
// Split into words
words = [
  "Throughput", "optimization", "is", "essential", "for", "production", "systems—we've",
  "implemented", "batch", "processing", "with", "dynamic", "batching", "algorithms",
  "that", "group", "similar", "spatial", "queries", "to", "maximize", "GPU",
  "utilization.", "Error", "handling", "becomes", "complex", "when", "LLMs",
  "hallucinate", "spatial", "relationships;", "we", "use", "confidence", "scoring",
  "and", "geometric", "validation", "to", "filter", "unreliable", "outputs.",
  "The", "third", "bottleneck", "is", "model", "fine-tuning", "for",
  "domain-specific", "geospatial", "terminology;", "we", "maintain", "curated",
  "datasets", "of", "spatial", "feature", "descriptions", "and", "use", "LoRA",
  "adapters", "to", "specialize", "base", "models", "without", "full",
  "retraining", "overhead."
]

// Stream each word
i=0: onChunk("Throughput") → wait 30ms
i=1: onChunk(" optimization") → wait 30ms
i=2: onChunk(" is") → wait 30ms
i=3: onChunk(" essential") → wait 30ms
...
i=71: onChunk(" overhead.") → done
```

**Callback Execution**: Each `onChunk()` call triggers UI update in App.tsx

---

### Step 9: Display in UI

**Location**: `src/App.tsx` (streaming callback)

**Input Data** (per chunk):
```javascript
chunk = "Throughput"  // first chunk
chunk = " optimization"  // second chunk
chunk = " is"  // third chunk
// ... etc
```

**Code Executed** (in streaming callback):
```typescript
onChunk: (chunk: string) => {
  // Append chunk to current message
  setMessages(prev => {
    const updated = [...prev];
    const lastMsg = updated[updated.length - 1];
    lastMsg.text += chunk;
    return updated;
  });
  
  // Update TTS if enabled
  if (ttsEnabled) {
    ttsSpeak(chunk, personaVoice);
  }
}
```

**UI Updates** (progressive):
```
Time 0ms:    "Throughput"
Time 30ms:   "Throughput optimization"
Time 60ms:   "Throughput optimization is"
Time 90ms:   "Throughput optimization is essential"
...
Time 2130ms: "Throughput optimization is essential for production systems—we've implemented batch processing with dynamic batching algorithms that group similar spatial queries to maximize GPU utilization. Error handling becomes complex when LLMs hallucinate spatial relationships; we use confidence scoring and geometric validation to filter unreliable outputs. The third bottleneck is model fine-tuning for domain-specific geospatial terminology; we maintain curated datasets of spatial feature descriptions and use LoRA adapters to specialize base models without full retraining overhead."
```

**Visual Result**: Marcus's avatar displays the response with natural typing effect

---

## Complete Data Flow Summary

```
User Input
  ↓
"What are the integration bottlenecks?" + personaId="marcus"
  ↓
shouldUseBackup() → true
  ↓
extractUserQuestion() → "What are the integration bottlenecks?"
  ↓
findMatchingBackupQuestion() → "q1-technical-bottlenecks"
  ↓
loadBackupResponses() → fetch /demo-backup/q1-technical-bottlenecks.json
  ↓
Extract responses["marcus"].content → "Throughput optimization is essential..."
  ↓
streamBackupResponse() → split into 72 words
  ↓
onChunk() called 72 times with 30ms delays
  ↓
UI updates progressively
  ↓
Final display: Marcus's complete response with natural streaming effect
```

---

## Key Data Transformations

| Step | Input | Output |
|------|-------|--------|
| 1. Submit | User text | ChatRequest with personaId |
| 2. Check | ChatRequest | Boolean (use backup?) |
| 3. Extract | ChatMessage[] | User question string |
| 4. Match | Question string | Question ID or null |
| 5. Load | Question ID | JSON object |
| 6. Extract | JSON + personaId | Response text |
| 7. Stream | Response text | Word chunks |
| 8. Display | Word chunks | UI updates |

---

## Console Output (Complete Example)

```
📦 Backup mode active - using pre-generated response with streaming simulation
📦 Found matching backup question: q1-technical-bottlenecks
✅ Using pre-generated backup response for marcus
```

---

## What If No Match?

If the question was "What's your favorite color?":

```
findMatchingBackupQuestion("What's your favorite color?")
  ↓
Title matching: 0% match for all questions
  ↓
Keyword matching: No patterns match
  ↓
Return null
  ↓
getGenericFallbackResponse("marcus")
  ↓
Return: "Good question. In my experience deploying geospatial AI systems at scale, what matters most is what actually works in production. We need solutions that are reliable, secure, and deliver measurable results. Theory is important, but operational reality is what counts."
```

---

## Timing Analysis

**Total time for streaming**: ~2.13 seconds (72 words × 30ms)

**Breakdown**:
- Question extraction: <1ms
- Question matching: <1ms
- JSON fetch: ~10-50ms (network)
- Response extraction: <1ms
- Streaming simulation: 2130ms (intentional delay)

**Comparison to live LLM**:
- Live LLM: 5-15 seconds for similar response
- Backup streaming: 2.13 seconds
- Backup non-streaming: <100ms

The backup system is **faster** than live LLM while maintaining natural UX!

---

## Conclusion

This example demonstrates how a simple user question flows through the entire backup system, from initial submission through question matching, response retrieval, streaming simulation, and final display. The system is designed to be transparent (console logs), efficient (fast matching), and natural (streaming simulation), providing a seamless fallback experience when live AI is unavailable.

