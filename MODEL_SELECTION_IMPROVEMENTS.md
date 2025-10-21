# Model Selection Improvements

## Summary

Enhanced the per-persona model selection UI to automatically detect available models from LM Studio (or other providers) and present them in dropdown comboboxes instead of free-text inputs. Also added a "Randomize Models" button to quickly assign different models to each persona.

## Changes Made

### 1. Automatic Model Detection & Combobox Selection

**Before:**
- Users had to manually type model names into text input fields
- No validation or autocomplete
- Easy to make typos or use incorrect model names

**After:**
- When models are available (after clicking "Test Connection" or "Refresh Models"), dropdown comboboxes automatically appear
- Shows all available models from the connected provider
- Includes a "Use Default Model" option to clear the override
- Falls back to text input if no models are detected (for manual entry)

### 2. Randomize Models Button

**New Feature:**
- A "🎲 Randomize Models" button appears when models are available
- Clicking it assigns a random model to each persona
- Ensures different models are used when possible (shuffles the list)
- If there are more personas than models, cycles through the available models
- Great for testing different model combinations quickly

### 3. Model Count Display

- Shows the number of available models next to the Randomize button
- Helps users understand how many models are loaded

## User Experience

### Workflow

1. **Open Settings** → Click the Settings button
2. **Select Provider** → Choose "LM Studio" (or another provider)
3. **Test Connection** → Click "🔌 Test Connection"
   - This automatically fetches available models
4. **See Dropdowns** → Per-persona model fields now show as dropdowns
5. **Quick Assignment** → Click "🎲 Randomize Models" to assign different models
6. **Manual Selection** → Or manually select models from the dropdowns

### Example Scenario

If you have LM Studio running with these models loaded:
- `llama-3.1-8b-instruct`
- `mistral-7b-instruct`
- `gemma-2-9b-it`
- `deepseek-r1:7b`
- `qwen2.5-7b-instruct`

Clicking "🎲 Randomize Models" might assign:
- Maya Ríos → `deepseek-r1:7b`
- Prof. Otto Reinhardt → `llama-3.1-8b-instruct`
- Dr. Sarah Chen → `gemma-2-9b-it`
- Dr. Marcus Webb → `mistral-7b-instruct`
- Lt. Colonel Jessica Park → `qwen2.5-7b-instruct`

Each persona gets a different model, creating diverse perspectives!

## Technical Details

### Code Changes

**File:** `src/App.tsx`

**Lines 675-723:** Updated the per-persona model selection UI

Key changes:
1. Added conditional rendering: `availableModels.length > 0 ? <select> : <input>`
2. Added "Randomize Models" button with shuffle logic
3. Dropdown shows "Use Default Model" option plus all available models
4. Model count display for user feedback

### Randomization Algorithm

```typescript
const shuffled = [...availableModels].sort(() => Math.random() - 0.5);
const newAssignments: Record<string, string> = {};
selectedPersonas.forEach((p, idx) => {
  // Use modulo to cycle through models if there are more personas than models
  newAssignments[p.id] = shuffled[idx % shuffled.length];
});
setPersonaModels(newAssignments);
```

This ensures:
- Random order of models
- Different models for each persona (when possible)
- Handles edge cases (more personas than models)

## Benefits

### 1. **Reduced Errors**
- No more typos in model names
- Only valid models can be selected
- Clear visual feedback of available options

### 2. **Faster Configuration**
- One-click randomization for quick testing
- No need to remember exact model names
- Easy to experiment with different combinations

### 3. **Better Discovery**
- Users can see all available models at a glance
- Encourages trying different models
- Makes it obvious which models are loaded

### 4. **Improved UX**
- Consistent with modern UI patterns (dropdowns vs free text)
- Visual indication of model count
- Graceful fallback to text input if needed

## Testing Recommendations

### Manual Testing

1. **Test with LM Studio:**
   ```bash
   # Start LM Studio with multiple models loaded
   # Open GeoAI MetaPanel
   # Settings → LM Studio → Test Connection
   # Verify dropdowns appear
   # Click Randomize Models
   # Verify different models are assigned
   ```

2. **Test with Ollama:**
   ```bash
   ollama serve
   ollama pull llama3.1
   ollama pull mistral
   ollama pull gemma2
   # Open GeoAI MetaPanel
   # Settings → Ollama → Test Connection
   # Verify dropdowns appear
   ```

3. **Test with No Models:**
   - Don't connect to any provider
   - Verify text inputs appear (fallback behavior)
   - Verify you can still manually enter model names

4. **Test Edge Cases:**
   - Only 1 model available → Randomize assigns same model to all
   - More personas than models → Verify cycling works
   - Clear a selection → Verify "Use Default Model" works

### Expected Behavior

✅ **When models are available:**
- Dropdowns appear for each persona
- "Randomize Models" button is visible
- Model count is displayed
- Clicking Randomize assigns different models

✅ **When no models are available:**
- Text inputs appear (fallback)
- No Randomize button
- Users can manually type model names

✅ **Persistence:**
- Selected models are saved to localStorage
- Persist across app restarts
- Work correctly with all providers

## Future Enhancements

Possible improvements for future versions:

1. **Model Metadata Display**
   - Show model size, quantization, context length in dropdown
   - Example: "llama-3.1-8b-instruct (Q4_K_M, 8K context)"

2. **Smart Assignment**
   - Assign models based on persona characteristics
   - Example: Assign larger models to more technical personas

3. **Model Performance Indicators**
   - Show which models are faster/slower
   - Display memory usage estimates

4. **Preset Combinations**
   - Save favorite model combinations
   - Quick-load presets like "All Llama" or "Mixed Models"

5. **Model Filtering**
   - Filter by size, quantization, or capabilities
   - Search/filter in dropdown for large model lists

## Compatibility

- ✅ Works with all existing providers (Ollama, LM Studio, OpenAI, Custom)
- ✅ Backward compatible with existing configurations
- ✅ Graceful fallback for edge cases
- ✅ No breaking changes to existing functionality

## Related Files

- `src/App.tsx` - Main UI changes
- `src/services/llm.ts` - Model listing functionality (already existed)
- `src/components/LLMProviderSelector.tsx` - Provider selection (unchanged)

## Documentation Updates Needed

Consider updating these files:
- `QUICK_START_LM_STUDIO.md` - Add section about model selection
- `LLM_SETUP_GUIDE.md` - Document the new UI features
- `USAGE_EXAMPLES.md` - Add examples of using Randomize Models

## Conclusion

These improvements make it much easier to experiment with different model combinations and reduce configuration errors. The automatic detection and dropdown UI follows modern UX patterns while maintaining backward compatibility with manual text entry when needed.

