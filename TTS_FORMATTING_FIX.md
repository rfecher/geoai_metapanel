# TTS Formatting Fix - Summary

## Problem
Persona models were generating responses with formatting markers like:
- Asterisks for emphasis: `*word*` or `**word**`
- XML/thinking tags: `<thinking>...</thinking>` (especially common with Qwen models)
- Underscores for emphasis: `_word_`
- Internal reasoning that shouldn't be spoken aloud

These formatting markers were being read aloud by text-to-speech engines, creating a poor audio experience.

**Special Note on Qwen Models:** Qwen models are particularly prone to using `<thinking>` tags for internal reasoning. The solution specifically targets this behavior.

---

## Solution: Two-Layer Defense

### Layer 1: Stronger System Prompts ✅
Updated all five persona system prompts with explicit, forceful instructions:

```
CRITICAL OUTPUT FORMAT REQUIREMENTS:
- Your responses will be spoken aloud using text-to-speech. DO NOT use any formatting markers.
- NEVER use asterisks (*word*), underscores (_word_), or any markdown formatting.
- NEVER use XML tags. Specifically: NO <thinking> tags, NO <emphasis> tags, NO <note> tags, NO tags of any kind.
- Do NOT include internal reasoning or meta-commentary. Only output what should be spoken.
- NEVER use brackets or special characters for emphasis.
- Write ONLY plain text that sounds natural when spoken aloud.
- Use punctuation (commas, periods, dashes) and word choice to convey emphasis naturally.
- Example: Instead of "*really* important", say "This is really important" or "This is critically important".
- Example: Instead of "<thinking>I should emphasize this</thinking>Important point", just say "Important point".
```

**Why this works:**
- Uses strong imperative language (NEVER, DO NOT)
- Provides specific examples of what NOT to do
- Gives concrete alternatives for how to express emphasis
- Explains the context (text-to-speech) so models understand why

### Layer 2: Text Sanitization Safety Net ✅
Added a `sanitizeTextForTTS()` function in `src/services/tts.ts` that automatically strips out formatting markers:

```typescript
function sanitizeTextForTTS(text: string): string {
  let cleaned = text;

  // Remove <thinking>...</thinking> blocks (including multi-line content)
  // This must be done first before other tag removal
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Remove other common XML/HTML-style tags with content
  cleaned = cleaned.replace(/<emphasis>[\s\S]*?<\/emphasis>/gi, '$1');
  cleaned = cleaned.replace(/<note>[\s\S]*?<\/note>/gi, '');
  cleaned = cleaned.replace(/<internal>[\s\S]*?<\/internal>/gi, '');

  // Remove any remaining XML/HTML-style tags (self-closing or empty)
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Remove asterisks used for emphasis (*word* or **word**)
  cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // Triple first
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');     // Double
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');         // Single

  // Remove underscores used for emphasis (_word_ or __word__)
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Clean up any multiple spaces or newlines created by removals
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
```

**Why this is important:**
- Catches any formatting that slips through despite prompt instructions
- **Specifically handles multi-line `<thinking>` blocks** using `[\s\S]*?` regex pattern
- Works for all TTS providers (Piper, Web Speech, Azure, ElevenLabs)
- Logs when sanitization occurs so you can monitor model behavior
- Zero impact on properly formatted responses
- Processes tags in order: thinking blocks first, then other tags, then formatting

---

## Files Modified

### 1. `src/data/personas.ts`
- Updated all 5 persona system prompts
- Added "CRITICAL OUTPUT FORMAT REQUIREMENTS" section to each
- Personas affected:
  - Maya Ríos
  - Prof. Otto Reinhardt
  - Dr. Sarah Chen
  - Dr. Marcus Webb
  - Lt. Colonel Jessica Park

### 2. `src/services/tts.ts`
- Added `sanitizeTextForTTS()` function
- Modified `ttsSpeak()` to sanitize all text before speaking
- Added logging to track when sanitization removes formatting
- Applied to all TTS providers

---

## Testing

### Before Testing:
1. Restart your app to load the updated persona prompts
2. Open browser console to see sanitization logs

### Test Cases:
1. **Ask a provocative question** that might trigger emphatic responses:
   - "Why should we trust open source over proprietary solutions?"
   - "Isn't Indigenous data governance too slow for modern needs?"
   
2. **Check the console** for sanitization logs:
   - Look for: `🧹 Sanitized text (removed formatting)`
   - This shows the safety net is working

3. **Listen to the audio** - should sound natural without:
   - "asterisk word asterisk"
   - "less than thinking greater than"
   - Any other formatting artifacts

### Expected Results:
- **Best case:** Models follow instructions, no sanitization needed
- **Good case:** Models occasionally slip up, sanitization catches it
- **Worst case:** Heavy sanitization needed (indicates prompt tuning needed)

---

## Why This Approach?

### Prompt-First Strategy
We prioritize fixing the root cause (model behavior) rather than just treating symptoms:
- ✅ Models learn to generate proper speech-formatted text
- ✅ More natural, conversational responses
- ✅ Better long-term solution as models improve

### Safety Net Strategy
But we don't rely solely on prompts:
- ✅ Handles edge cases and model failures gracefully
- ✅ Works across different LLM providers (OpenAI, Ollama, etc.)
- ✅ Zero user-facing errors even when models misbehave

---

## Monitoring

Check the browser console for these logs:

```
🔊 TTS Speak called: { provider: 'piper', personaId: 'maya', ... }
🧹 Sanitized text (removed formatting): { original: '...', cleaned: '...' }
```

If you see frequent sanitization logs, it means:
1. The model is still using formatting despite instructions
2. The safety net is working correctly
3. You might want to further tune the system prompts for that specific model

---

## Future Improvements

If models continue to use formatting heavily:

1. **Model-specific prompts:** Different models respond to different instruction styles
2. **Few-shot examples:** Add example Q&A pairs showing proper plain-text responses
3. **Post-processing rules:** Add more sophisticated text cleaning (e.g., handling lists, quotes)
4. **Temperature tuning:** Lower temperature might reduce creative formatting

---

## Summary

✅ **Stronger prompts** tell models exactly what not to do  
✅ **Automatic sanitization** catches anything that slips through  
✅ **Logging** helps monitor and improve over time  
✅ **Works for all TTS providers** (Piper, Web Speech, Azure, ElevenLabs)  

Your personas should now generate clean, natural speech-ready text! 🎤✨

