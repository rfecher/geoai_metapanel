# Debugging LLM Connection Issues

## Problem: "Offline fallback" message even though connection test works

This guide will help you debug why the app shows offline fallback messages.

---

## Quick Debug Steps

### Step 1: Open DevTools
```bash
npm run dev:debug
```

This opens the Chrome DevTools automatically where you can see console logs.

### Step 2: Try to Send a Message

1. Type a question
2. Click Send
3. Watch the console output

### Step 3: Look for These Log Messages

The app now logs detailed information:

**🔵 Blue logs** = Normal operation:
- `🔵 Sending request to: http://localhost:1234/v1/chat/completions`
- `🔵 Model: your-model-name`
- `🔵 Messages: 3 messages`
- `🔵 Response status: 200`
- `🔵 Response data: {...}`
- `✅ Got response: ...`

**🔴 Red logs** = Errors:
- `❌ lmstudio error:`
- `🔴 Error response: ...`
- `🔴 Empty or invalid content:`

---

## Common Issues and Solutions

### Issue 1: Wrong URL

**Symptoms:**
```
❌ lmstudio error: TypeError: Failed to fetch
Config: { provider: 'lmstudio', baseUrl: 'http://localhost:1234', model: 'local-model' }
```

**Solution:**
1. Check LM Studio is running
2. Verify the port (usually 1234)
3. In LM Studio, go to Local Server tab → check the address
4. Update base URL in Settings if different

---

### Issue 2: No Model Loaded

**Symptoms:**
```
🔵 Response status: 400
🔴 Error response: {"error": "No model loaded"}
```

**Solution:**
1. In LM Studio, go to Local Server tab
2. Select a model from the dropdown
3. Make sure it says "Model loaded"
4. Try again

---

### Issue 3: Wrong Model Name

**Symptoms:**
```
🔵 Response status: 404
🔴 Error response: {"error": "Model not found"}
```

**Solution:**
1. In GeoAI MetaPanel Settings, click "🔄 Refresh"
2. Look at the available models list
3. Copy the exact model name
4. Paste into "Default Model" field
5. Try again

---

### Issue 4: Empty Response

**Symptoms:**
```
🔵 Response status: 200
🔵 Response data: {"choices": []}
🔴 Empty or invalid content
```

**Solution:**
1. The model returned successfully but with no content
2. Try a different model
3. Check LM Studio console for errors
4. Restart LM Studio server

---

### Issue 5: CORS Error

**Symptoms:**
```
❌ lmstudio error: TypeError: NetworkError when attempting to fetch resource
Access to fetch at 'http://localhost:1234/v1/chat/completions' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
This shouldn't happen with LM Studio, but if it does:
1. Restart LM Studio
2. Restart the app
3. Check LM Studio settings for CORS configuration

---

## Detailed Debugging Process

### 1. Verify LM Studio is Running

**Check:**
- LM Studio app is open
- Local Server tab shows "Server running"
- Green indicator next to port number

**Test manually:**
```bash
curl http://localhost:1234/v1/models
```

Should return a list of models.

### 2. Check Model is Loaded

**In LM Studio:**
- Local Server tab
- Model dropdown shows a model
- Status shows "Model loaded" or similar

**Test manually:**
```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Should return a response with content.

### 3. Check App Configuration

**In GeoAI MetaPanel Settings:**
- Provider: LM Studio (localhost:1234)
- Base URL: `http://localhost:1234`
- Default Model: (the exact name from LM Studio)

**Test connection:**
- Click "🔌 Test Connection"
- Should show "✓ Connected successfully"
- Should show "Found X model(s)"

### 4. Check Console Logs

**Open DevTools:**
```bash
npm run dev:debug
```

**Or use keyboard shortcut:**
- macOS: Cmd+Option+I
- Windows/Linux: Ctrl+Shift+I

**Send a message and watch for:**
1. Request being sent (🔵 logs)
2. Response status
3. Response data
4. Any errors (🔴 or ❌ logs)

---

## Understanding the Logs

### Successful Request
```
🔵 Sending request to: http://localhost:1234/v1/chat/completions
🔵 Model: llama-3.1-8b-instruct
🔵 Messages: 3 messages
🔵 Response status: 200
🔵 Response data: {choices: [{message: {content: "..."}}]}
✅ Got response: Here is my response...
```

### Failed Request
```
🔵 Sending request to: http://localhost:1234/v1/chat/completions
🔵 Model: wrong-model-name
🔵 Messages: 3 messages
🔵 Response status: 404
🔴 Error response: {"error": "Model not found"}
❌ lmstudio error: Error: API HTTP 404: {"error": "Model not found"}
Config: {provider: 'lmstudio', baseUrl: 'http://localhost:1234', model: 'wrong-model-name'}
Full error: API HTTP 404: {"error": "Model not found"}
```

---

## Quick Fixes

### Fix 1: Restart Everything
```bash
# 1. Close GeoAI MetaPanel
# 2. In LM Studio: Stop Server → Start Server
# 3. Restart GeoAI MetaPanel
npm run dev
```

### Fix 2: Use Exact Model Name
1. In LM Studio Local Server tab, note the exact model identifier
2. In GeoAI MetaPanel Settings:
   - Click "🔄 Refresh"
   - Copy the model name from the list
   - Paste into "Default Model"

### Fix 3: Try a Different Model
1. In LM Studio, download a different model
2. Load it in Local Server
3. In GeoAI MetaPanel, refresh and select the new model

### Fix 4: Check Port
1. In LM Studio, check the port number (usually 1234)
2. In GeoAI MetaPanel Settings:
   - Base URL: `http://localhost:[PORT]`
   - Replace [PORT] with actual port number

---

## Still Not Working?

### Collect Debug Information

1. **LM Studio Info:**
   - Version
   - Model loaded
   - Port number
   - Any error messages in LM Studio console

2. **GeoAI MetaPanel Info:**
   - Provider setting
   - Base URL
   - Model name
   - Console logs (copy the error messages)

3. **Test Connection:**
   ```bash
   # Test if LM Studio is responding
   curl -v http://localhost:1234/v1/models
   
   # Test a simple chat
   curl http://localhost:1234/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "local-model",
       "messages": [{"role": "user", "content": "test"}]
     }'
   ```

4. **Share the output** of the above commands and console logs

---

## Common Mistakes

### ❌ Wrong: Using Ollama URL for LM Studio
```
Provider: LM Studio
Base URL: http://localhost:11434  ← Wrong! This is Ollama's port
```

### ✅ Correct:
```
Provider: LM Studio
Base URL: http://localhost:1234
```

---

### ❌ Wrong: Model name doesn't match
```
LM Studio shows: "llama-3.1-8b-instruct-q4"
GeoAI MetaPanel: "llama3.1"  ← Wrong!
```

### ✅ Correct:
```
LM Studio shows: "llama-3.1-8b-instruct-q4"
GeoAI MetaPanel: "llama-3.1-8b-instruct-q4"  ← Exact match!
```

---

### ❌ Wrong: Server not started
```
LM Studio Local Server tab shows: "Start Server" button
```

### ✅ Correct:
```
LM Studio Local Server tab shows: "Stop Server" button (server is running)
```

---

## Emergency Fallback

If nothing works, switch to Ollama temporarily:

```bash
# Install Ollama
# Download from https://ollama.ai

# Pull a model
ollama pull llama3.1

# Start Ollama
ollama serve

# In GeoAI MetaPanel Settings:
# - Provider: Ollama
# - Base URL: http://localhost:11434
# - Model: llama3.1
# - Test Connection
```

---

## Summary

**Most common issue:** Model name mismatch

**Quick fix:**
1. Click "🔄 Refresh" in Settings
2. Copy exact model name from the list
3. Paste into "Default Model"
4. Try again

**Still stuck?**
1. Run `npm run dev:debug`
2. Send a message
3. Copy the console error logs
4. Check against the common issues above

---

## Need More Help?

Include this information:
- LM Studio version
- Model name (exact)
- Base URL
- Console error logs (from DevTools)
- Output of `curl http://localhost:1234/v1/models`

