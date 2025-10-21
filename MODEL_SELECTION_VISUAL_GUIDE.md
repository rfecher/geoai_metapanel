# Model Selection Visual Guide

## Before vs After

### BEFORE: Free-text Input
```
┌─────────────────────────────────────────────────────────┐
│ Per-persona model overrides (optional)                  │
│ Leave blank to use the Default Model above              │
│                                                          │
│ Available: llama-3.1-8b-instruct, mistral-7b-inst...    │
│                                                          │
│ Maya Ríos        [________________________]             │
│                   e.g. mistral, gemma, llama3.1         │
│                                                          │
│ Prof. Otto       [________________________]             │
│                   e.g. mistral, gemma, llama3.1         │
│                                                          │
│ Dr. Sarah Chen   [________________________]             │
│                   e.g. mistral, gemma, llama3.1         │
└─────────────────────────────────────────────────────────┘
```

**Problems:**
- ❌ Users must type exact model names
- ❌ Easy to make typos
- ❌ No validation
- ❌ Can't see available options
- ❌ Tedious to configure multiple personas

---

### AFTER: Dropdown Comboboxes + Randomize

```
┌─────────────────────────────────────────────────────────┐
│ Per-persona model overrides (optional)                  │
│ Leave blank to use the Default Model above              │
│                                                          │
│ [🎲 Randomize Models]  5 model(s) available            │
│                                                          │
│ Maya Ríos        [Use Default Model          ▼]        │
│                   ├─ Use Default Model                  │
│                   ├─ llama-3.1-8b-instruct              │
│                   ├─ mistral-7b-instruct                │
│                   ├─ gemma-2-9b-it                      │
│                   ├─ deepseek-r1:7b                     │
│                   └─ qwen2.5-7b-instruct                │
│                                                          │
│ Prof. Otto       [llama-3.1-8b-instruct      ▼]        │
│                                                          │
│ Dr. Sarah Chen   [gemma-2-9b-it              ▼]        │
│                                                          │
│ Dr. Marcus Webb  [mistral-7b-instruct        ▼]        │
│                                                          │
│ Lt. Col. Park    [deepseek-r1:7b             ▼]        │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Click to select from available models
- ✅ No typos possible
- ✅ See all options at a glance
- ✅ One-click randomization
- ✅ Fast configuration

---

## Feature Walkthrough

### Step 1: Connect to LM Studio

```
┌─────────────────────────────────────────────────────────┐
│ LLM Provider                                             │
│ [LM Studio (localhost:1234)          ▼]                │
│                                                          │
│ Base URL                                                 │
│ [http://localhost:1234                ]                │
│                                                          │
│ Default Model                                            │
│ [llama-3.1-8b-instruct    ] [🔄 Refresh]               │
│                                                          │
│ [🔌 Test Connection]                                    │
│                                                          │
│ ✓ Connected successfully                                │
│   Found 5 model(s)                                      │
└─────────────────────────────────────────────────────────┘
```

**Action:** Click "🔌 Test Connection" or "🔄 Refresh"
**Result:** Models are automatically fetched from LM Studio

---

### Step 2: See Dropdown Comboboxes

After connecting, the per-persona section changes:

```
┌─────────────────────────────────────────────────────────┐
│ Per-persona model overrides (optional)                  │
│ Leave blank to use the Default Model above              │
│                                                          │
│ [🎲 Randomize Models]  5 model(s) available            │
│                                                          │
│ Maya Ríos        [Use Default Model          ▼]        │
│ Prof. Otto       [Use Default Model          ▼]        │
│ Dr. Sarah Chen   [Use Default Model          ▼]        │
│ Dr. Marcus Webb  [Use Default Model          ▼]        │
│ Lt. Col. Park    [Use Default Model          ▼]        │
└─────────────────────────────────────────────────────────┘
```

**Notice:**
- Text inputs → Dropdown comboboxes
- "🎲 Randomize Models" button appears
- Model count displayed

---

### Step 3: Click "🎲 Randomize Models"

**Before Click:**
```
Maya Ríos        [Use Default Model          ▼]
Prof. Otto       [Use Default Model          ▼]
Dr. Sarah Chen   [Use Default Model          ▼]
Dr. Marcus Webb  [Use Default Model          ▼]
Lt. Col. Park    [Use Default Model          ▼]
```

**After Click:**
```
Maya Ríos        [deepseek-r1:7b             ▼]
Prof. Otto       [llama-3.1-8b-instruct      ▼]
Dr. Sarah Chen   [gemma-2-9b-it              ▼]
Dr. Marcus Webb  [mistral-7b-instruct        ▼]
Lt. Col. Park    [qwen2.5-7b-instruct        ▼]
```

**Result:** Each persona gets a different model (when possible)

---

### Step 4: Manual Override (Optional)

You can still manually select models:

```
Maya Ríos        [deepseek-r1:7b             ▼]
                  ├─ Use Default Model
                  ├─ llama-3.1-8b-instruct
                  ├─ mistral-7b-instruct
                  ├─ gemma-2-9b-it
                  ├─ deepseek-r1:7b          ← Currently selected
                  └─ qwen2.5-7b-instruct
```

**Action:** Click dropdown → Select different model
**Result:** Persona uses the selected model

---

## Use Cases

### Use Case 1: Quick Testing

**Goal:** Test how different models respond to the same question

**Steps:**
1. Connect to LM Studio
2. Click "🎲 Randomize Models"
3. Ask a question
4. Compare responses from different models

**Example Question:**
> "What are the ethical implications of using satellite imagery for disaster response?"

**Result:**
- Maya (deepseek-r1:7b) → Focuses on Indigenous data sovereignty
- Otto (llama-3.1) → Emphasizes coordinate system accuracy
- Sarah (gemma-2) → Discusses open-source solutions
- Marcus (mistral) → Highlights operational efficiency
- Jessica (qwen2.5) → Addresses national security concerns

Each model brings a slightly different perspective!

---

### Use Case 2: Performance Comparison

**Goal:** Find the fastest model for your hardware

**Steps:**
1. Randomize models
2. Ask the same question multiple times
3. Observe response times
4. Select the fastest model as default

**Observation:**
```
deepseek-r1:7b        → 2.3s response time
llama-3.1-8b-instruct → 1.8s response time ← Fastest!
gemma-2-9b-it         → 2.5s response time
mistral-7b-instruct   → 2.1s response time
qwen2.5-7b-instruct   → 2.4s response time
```

**Action:** Set `llama-3.1-8b-instruct` as Default Model

---

### Use Case 3: Specialized Assignments

**Goal:** Assign models based on persona expertise

**Manual Selection:**
```
Maya Ríos        [deepseek-r1:7b             ▼]  ← Reasoning model for ethics
Prof. Otto       [llama-3.1-8b-instruct      ▼]  ← Technical accuracy
Dr. Sarah Chen   [mistral-7b-instruct        ▼]  ← Open-source focus
Dr. Marcus Webb  [qwen2.5-7b-instruct        ▼]  ← Business/operations
Lt. Col. Park    [gemma-2-9b-it              ▼]  ← Security/policy
```

**Rationale:**
- DeepSeek R1 for complex ethical reasoning (Maya)
- Llama 3.1 for technical precision (Otto)
- Mistral for balanced responses (Sarah)
- Qwen for business context (Marcus)
- Gemma for policy analysis (Jessica)

---

## Edge Cases

### Edge Case 1: Only 1 Model Available

**Scenario:** LM Studio has only one model loaded

**UI:**
```
[🎲 Randomize Models]  1 model(s) available

Maya Ríos        [llama-3.1-8b-instruct      ▼]
Prof. Otto       [llama-3.1-8b-instruct      ▼]
Dr. Sarah Chen   [llama-3.1-8b-instruct      ▼]
Dr. Marcus Webb  [llama-3.1-8b-instruct      ▼]
Lt. Col. Park    [llama-3.1-8b-instruct      ▼]
```

**Behavior:** All personas get the same model (expected)

---

### Edge Case 2: No Models Available

**Scenario:** Not connected to any provider

**UI:**
```
Per-persona model overrides (optional)
Leave blank to use the Default Model above

Maya Ríos        [________________________]
                  e.g. mistral, gemma, llama3.1

Prof. Otto       [________________________]
                  e.g. mistral, gemma, llama3.1
```

**Behavior:** Falls back to text inputs (graceful degradation)

---

### Edge Case 3: More Personas Than Models

**Scenario:** 5 personas, 3 models available

**Before Randomize:**
```
3 model(s) available:
- llama-3.1-8b-instruct
- mistral-7b-instruct
- gemma-2-9b-it
```

**After Randomize:**
```
Maya Ríos        [gemma-2-9b-it              ▼]  ← Model 1
Prof. Otto       [llama-3.1-8b-instruct      ▼]  ← Model 2
Dr. Sarah Chen   [mistral-7b-instruct        ▼]  ← Model 3
Dr. Marcus Webb  [gemma-2-9b-it              ▼]  ← Model 1 (cycle)
Lt. Col. Park    [llama-3.1-8b-instruct      ▼]  ← Model 2 (cycle)
```

**Behavior:** Cycles through available models using modulo

---

## Tips & Tricks

### Tip 1: Refresh Models After Loading New Ones

If you load a new model in LM Studio:
1. Go to Settings in GeoAI MetaPanel
2. Click "🔄 Refresh" next to Default Model
3. New model appears in dropdowns

### Tip 2: Clear All Overrides

To reset all personas to use the Default Model:
1. Manually select "Use Default Model" for each persona
2. Or close/reopen settings and click Randomize again

### Tip 3: Save Favorite Combinations

The app automatically saves your selections to localStorage:
- Selections persist across app restarts
- Each persona remembers its assigned model
- No need to reconfigure every time

### Tip 4: Test Connection First

Always click "🔌 Test Connection" before using dropdowns:
- Ensures models are up-to-date
- Validates connection to provider
- Populates dropdown options

---

## Keyboard Shortcuts

When using dropdowns:
- **Arrow Keys** → Navigate options
- **Enter** → Select option
- **Escape** → Close dropdown
- **Type** → Jump to matching option

Example: Type "m" to jump to "mistral-7b-instruct"

---

## Troubleshooting

### Problem: Dropdowns Don't Appear

**Cause:** Models not fetched from provider

**Solution:**
1. Verify LM Studio is running
2. Click "🔌 Test Connection"
3. Check for "✓ Connected successfully" message
4. Click "🔄 Refresh" if needed

---

### Problem: Randomize Button Missing

**Cause:** No models available

**Solution:**
1. Connect to a provider (LM Studio, Ollama, etc.)
2. Load at least one model
3. Click "🔌 Test Connection"
4. Button should appear

---

### Problem: Same Model Assigned to All Personas

**Cause:** Only one model available

**Solution:**
1. Load more models in LM Studio
2. Click "🔄 Refresh" in GeoAI MetaPanel
3. Click "🎲 Randomize Models" again

---

## Summary

The new model selection UI provides:
- ✅ **Automatic detection** of available models
- ✅ **Dropdown comboboxes** for easy selection
- ✅ **One-click randomization** for quick testing
- ✅ **Visual feedback** (model count, selections)
- ✅ **Graceful fallback** to text input when needed
- ✅ **Persistent settings** across app restarts

This makes it much easier to experiment with different model combinations and reduces configuration errors!

