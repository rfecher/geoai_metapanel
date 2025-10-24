# Quick Reference: Model Selection

## 🎯 Quick Start (30 seconds)

1. **Settings** → Click Settings button
2. **Connect** → Select "LM Studio" → Click "🔌 Test Connection"
3. **Randomize** → Click "🎲 Randomize Models"
4. **Done!** → Each persona now uses a different model

---

## 🎲 Randomize Models Button

### What It Does
Assigns a different model to each persona with one click.

### When It Appears
- ✅ After connecting to LM Studio (or other provider)
- ✅ After clicking "Test Connection" or "Refresh Models"
- ✅ When at least 1 model is available

### How It Works
```
Before:  All personas → Default Model
After:   Each persona → Different random model
```

**Example:**
```
Maya Ríos        → deepseek-r1:7b
Prof. Otto       → llama-3.1-8b-instruct
Dr. Sarah Chen   → gemma-2-9b-it
Dr. Marcus Webb  → mistral-7b-instruct
Lt. Col. Park    → qwen2.5-7b-instruct
```

---

## 📋 Dropdown Comboboxes

### What They Are
Dropdown menus showing all available models from your LLM provider.

### When They Appear
- ✅ After successful connection test
- ✅ When models are detected from provider
- ❌ Falls back to text input if no models available

### How to Use
1. Click dropdown for any persona
2. Select a model from the list
3. Or select "Use Default Model" to clear

**Options:**
```
[Use Default Model          ▼]
 ├─ Use Default Model       ← Clears override
 ├─ llama-3.1-8b-instruct
 ├─ mistral-7b-instruct
 ├─ gemma-2-9b-it
 ├─ deepseek-r1:7b
 └─ qwen2.5-7b-instruct
```

---

## 🔄 Workflow

### Standard Workflow
```
1. Open Settings
2. Select Provider (LM Studio, Ollama, etc.)
3. Click "Test Connection"
   → Models automatically detected
4. Click "Randomize Models"
   → Different models assigned
5. (Optional) Manually adjust any persona
6. Close Settings
7. Ask a question
   → Each persona uses their assigned model
```

### Quick Workflow (Already Connected)
```
1. Open Settings
2. Click "Randomize Models"
3. Close Settings
4. Done!
```

---

## 🎯 Use Cases

### Use Case 1: Quick Testing
**Goal:** Test different models quickly

**Steps:**
1. Click "Randomize Models"
2. Ask a question
3. Compare responses
4. Repeat to try different combinations

---

### Use Case 2: Find Fastest Model
**Goal:** Identify which model is fastest on your hardware

**Steps:**
1. Randomize models
2. Ask the same question multiple times
3. Observe response times
4. Set fastest model as Default

---

### Use Case 3: Specialized Assignment
**Goal:** Assign specific models to specific personas

**Steps:**
1. Click dropdown for each persona
2. Manually select appropriate model
3. Example:
   - Maya (ethics) → deepseek-r1:7b (reasoning)
   - Otto (technical) → llama-3.1 (accuracy)
   - Sarah (open-source) → mistral (balanced)

---

## ⚡ Keyboard Shortcuts

### In Dropdowns
- **↑↓** Arrow Keys → Navigate options
- **Enter** → Select option
- **Escape** → Close dropdown
- **Type** → Jump to matching option

**Example:** Type "m" to jump to "mistral"

---

## 🔧 Troubleshooting

### Problem: No Dropdowns Appear
**Solution:** Click "🔌 Test Connection" first

### Problem: No Randomize Button
**Solution:** Connect to provider and load models

### Problem: All Personas Get Same Model
**Solution:** Load more models in LM Studio

### Problem: Dropdown Shows Old Models
**Solution:** Click "🔄 Refresh" to update list

---

## 💡 Tips

### Tip 1: Refresh After Loading New Models
If you load a new model in LM Studio:
1. Go to Settings
2. Click "🔄 Refresh"
3. New model appears in dropdowns

### Tip 2: Clear All Overrides
To reset all personas to Default Model:
- Select "Use Default Model" for each persona

### Tip 3: Settings Persist
Your selections are automatically saved:
- Persist across app restarts
- No need to reconfigure every time

### Tip 4: Test Connection First
Always test connection before using dropdowns:
- Ensures models are up-to-date
- Validates provider connection
- Populates dropdown options

---

## 📊 Model Count Display

Shows how many models are available:

```
[🎲 Randomize Models]  5 model(s) available
```

**Meanings:**
- `1 model(s)` → All personas will get same model
- `3 model(s)` → Some personas will share models
- `5+ model(s)` → Each persona can get different model

---

## 🎨 Visual Indicators

### Connected with Models
```
✓ Connected successfully
  Found 5 model(s)

[🎲 Randomize Models]  5 model(s) available

Maya Ríos        [Use Default Model          ▼]
```

### Not Connected
```
Per-persona model overrides (optional)
Leave blank to use the Default Model above

Maya Ríos        [________________________]
                  e.g. mistral, gemma, llama3.1
```

---

## 🔄 Edge Cases

### Only 1 Model Available
**Behavior:** All personas get same model
**Expected:** Yes, this is normal

### More Personas Than Models
**Behavior:** Models cycle (repeat)
**Example:** 5 personas, 3 models → [M1, M2, M3, M1, M2]

### No Models Available
**Behavior:** Text inputs appear (fallback)
**Action:** You can still type model names manually

---

## 📝 Examples

### Example 1: All Different Models
```
5 personas, 5 models available:

Maya Ríos        → deepseek-r1:7b
Prof. Otto       → llama-3.1-8b-instruct
Dr. Sarah Chen   → gemma-2-9b-it
Dr. Marcus Webb  → mistral-7b-instruct
Lt. Col. Park    → qwen2.5-7b-instruct
```

### Example 2: Some Shared Models
```
5 personas, 3 models available:

Maya Ríos        → gemma-2-9b-it
Prof. Otto       → llama-3.1-8b-instruct
Dr. Sarah Chen   → mistral-7b-instruct
Dr. Marcus Webb  → gemma-2-9b-it        (same as Maya)
Lt. Col. Park    → llama-3.1-8b-instruct (same as Otto)
```

### Example 3: All Same Model
```
5 personas, 1 model available:

Maya Ríos        → llama-3.1-8b-instruct
Prof. Otto       → llama-3.1-8b-instruct
Dr. Sarah Chen   → llama-3.1-8b-instruct
Dr. Marcus Webb  → llama-3.1-8b-instruct
Lt. Col. Park    → llama-3.1-8b-instruct
```

---

## 🚀 Best Practices

### 1. Test Connection First
Always click "Test Connection" before using dropdowns.

### 2. Load Multiple Models
For best results, load 5+ models in LM Studio.

### 3. Experiment with Randomization
Try clicking "Randomize Models" multiple times to find interesting combinations.

### 4. Save Favorites Manually
If you find a good combination, remember it (or take a screenshot).

### 5. Use Default Model for Consistency
If you want all personas to use the same model, set it as Default and clear all overrides.

---

## 📚 Related Documentation

- **`MODEL_SELECTION_IMPROVEMENTS.md`** - Technical details
- **`MODEL_SELECTION_VISUAL_GUIDE.md`** - Detailed visual guide
- **`FEATURE_COMPLETE_MODEL_SELECTION.md`** - Implementation summary
- **`QUICK_START_LM_STUDIO.md`** - LM Studio setup guide
- **`LLM_SETUP_GUIDE.md`** - General LLM setup

---

## ❓ FAQ

### Q: Do I need to randomize every time?
**A:** No, selections persist across app restarts.

### Q: Can I manually select models?
**A:** Yes, click any dropdown to manually select.

### Q: What if I want all personas to use the same model?
**A:** Set it as Default Model and select "Use Default Model" for each persona.

### Q: Can I use different providers for different personas?
**A:** No, all personas use the same provider (but can use different models from that provider).

### Q: Does randomization guarantee different models?
**A:** Yes, if enough models are available. If not, some personas will share models.

### Q: Can I undo randomization?
**A:** No automatic undo, but you can manually change selections or randomize again.

---

## 🎉 Summary

**New Features:**
- ✅ Automatic model detection
- ✅ Dropdown comboboxes
- ✅ One-click randomization
- ✅ Model count display
- ✅ Graceful fallbacks

**Benefits:**
- ⚡ Faster configuration
- 🎯 No typos
- 🔄 Easy experimentation
- 👁️ Visual feedback
- 💾 Persistent settings

**Quick Start:**
1. Settings → Test Connection
2. Click "Randomize Models"
3. Done!

---

**Need Help?** See `MODEL_SELECTION_VISUAL_GUIDE.md` for detailed examples and troubleshooting.

