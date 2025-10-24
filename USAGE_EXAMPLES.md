# Usage Examples - Multi-Provider Setup

This guide shows practical examples of how to use GeoAI MetaPanel with different LLM providers.

## Example 1: Quick Start with LM Studio

**Scenario:** You're new to LLMs and want the easiest setup.

### Steps:
1. Download and install LM Studio
2. In LM Studio:
   - Click Search (🔍)
   - Search for "llama-3.1-8b"
   - Click Download
   - Go to Local Server tab (→)
   - Click "Start Server"
3. In GeoAI MetaPanel:
   - Click Settings
   - Select "LM Studio (localhost:1234)" from dropdown
   - Click "🔌 Test Connection"
   - See "✓ Connected successfully"
   - Close Settings
4. Type your question and click Send!

**Time:** 5 minutes  
**Cost:** Free  
**Result:** Working AI panel discussion

---

## Example 2: Using Ollama for Development

**Scenario:** You're a developer who wants scriptable, local LLMs.

### Steps:
1. Install Ollama from https://ollama.ai
2. In terminal:
   ```bash
   ollama pull llama3.1
   ollama pull mistral
   ollama serve
   ```
3. In GeoAI MetaPanel:
   - Click Settings
   - Select "Ollama (localhost:11434)" from dropdown
   - Click "🔄 Refresh" to see your models
   - Set Default Model to "llama3.1"
   - Close Settings
4. Start chatting!

**Time:** 5 minutes  
**Cost:** Free  
**Result:** Fast, private, scriptable LLM

---

## Example 3: Using OpenAI for Best Quality

**Scenario:** You're preparing a presentation and need the highest quality responses.

### Steps:
1. Sign up at https://platform.openai.com
2. Generate an API key
3. Add billing information
4. In GeoAI MetaPanel:
   - Click Settings
   - Select "OpenAI API" from dropdown
   - Paste your API key
   - Set Default Model to "gpt-4"
   - Click "🔌 Test Connection"
   - Close Settings
5. Ask your questions!

**Time:** 3 minutes  
**Cost:** ~$5-20 per session  
**Result:** Highest quality responses

---

## Example 4: Mixed Models for Different Personas

**Scenario:** You want different personas to use different models for varied perspectives.

### Setup:
1. Set up Ollama with multiple models:
   ```bash
   ollama pull llama3.1
   ollama pull mistral
   ollama pull deepseek-r1:7b
   ollama serve
   ```
2. In GeoAI MetaPanel Settings:
   - Provider: Ollama
   - Default Model: `llama3.1`
   - Per-persona overrides:
     - Maya Ríos: `mistral` (more creative/empathetic)
     - Otto Reinhardt: `deepseek-r1:7b` (more analytical)
     - Dr. Sarah Chen: (blank - uses default)
     - Marcus Webb: `llama3.1` (or blank)
     - Lt. Col. Jessica Hayes: `deepseek-r1:7b` (analytical)

**Result:** Each persona has a unique "voice" based on different models!

---

## Example 5: Cloud Backup for Offline Work

**Scenario:** You usually work offline with Ollama, but need a cloud backup for when you're traveling.

### Setup:
1. Primary: Ollama (for offline work)
   ```bash
   ollama pull llama3.1
   ollama serve
   ```
2. Backup: Get a Groq API key from https://console.groq.com

### Usage:
**At home (offline):**
- Settings → Ollama → Test Connection ✓
- Work normally

**Traveling (online, no GPU):**
- Settings → Custom Configuration
- Base URL: `https://api.groq.com/openai/v1`
- API Key: Your Groq key
- Model: `mixtral-8x7b-32768`
- Test Connection ✓
- Continue working!

**Result:** Seamless switching between local and cloud

---

## Example 6: Testing Multiple Models

**Scenario:** You want to compare different models to see which works best for GeoAI discussions.

### Process:
1. Set up LM Studio with multiple models:
   - Download: llama-3.1-8b, mistral-7b, phi-3-mini
2. For each model:
   - Load model in LM Studio
   - Start server
   - In GeoAI MetaPanel: Settings → Refresh → Test
   - Ask the same question
   - Note the quality and speed
3. Choose your favorite!

**Models to try:**
- **llama-3.1-8b**: Balanced, good general knowledge
- **mistral-7b**: Creative, nuanced responses
- **deepseek-coder-7b**: Technical, analytical
- **phi-3-mini**: Fast, good for quick tests

---

## Example 7: Budget-Conscious Setup

**Scenario:** You want the best experience without spending money.

### Setup:
1. **Primary:** Ollama (free, local)
   ```bash
   ollama pull llama3.1
   ```
2. **Backup:** Groq (free tier, cloud)
   - Sign up at https://console.groq.com
   - Get free API key

### Usage:
- Use Ollama for most work (free, unlimited)
- Switch to Groq when:
  - You need faster responses
  - Your laptop is running hot
  - You're on a device without GPU

**Cost:** $0/month  
**Result:** Full functionality, zero cost

---

## Example 8: Production Demo Setup

**Scenario:** You're demoing GeoAI MetaPanel to clients and need reliability.

### Setup:
1. **Primary:** OpenAI GPT-4 (most reliable)
   - API key with billing set up
   - Model: `gpt-4-turbo`
2. **Backup:** Ollama (in case of internet issues)
   ```bash
   ollama pull llama3.1
   ```

### Pre-Demo Checklist:
- [ ] Test OpenAI connection
- [ ] Verify billing has credits
- [ ] Test Ollama as backup
- [ ] Prepare sample questions
- [ ] Test all personas

**Result:** Reliable, high-quality demo

---

## Example 9: Privacy-Focused Setup

**Scenario:** You're working with sensitive GeoAI data and need complete privacy.

### Setup:
1. **Only use:** Ollama (100% local)
   ```bash
   ollama pull llama3.1
   ollama pull mistral
   ```
2. In GeoAI MetaPanel:
   - Provider: Ollama
   - Verify base URL is localhost
   - Never switch to cloud providers

### Verification:
- Disconnect from internet
- Test that app still works
- All data stays on your machine

**Result:** Complete privacy, no data leakage

---

## Example 10: Experimenting with Custom Endpoints

**Scenario:** You want to try different OpenAI-compatible services.

### Services to Try:

**Together.ai:**
```
Provider: Custom
Base URL: https://api.together.xyz/v1
API Key: Your Together.ai key
Model: mixtral-8x7b-32768
```

**Anyscale:**
```
Provider: Custom
Base URL: https://api.endpoints.anyscale.com/v1
API Key: Your Anyscale key
Model: meta-llama/Llama-2-70b-chat-hf
```

**Local Proxy:**
```
Provider: Custom
Base URL: http://localhost:8000/v1
API Key: (if needed)
Model: Your model name
```

**Result:** Flexibility to use any OpenAI-compatible service

---

## Common Workflows

### Daily Development Workflow
1. Morning: Start Ollama (`ollama serve`)
2. Open GeoAI MetaPanel
3. Settings already configured (persisted)
4. Start working immediately
5. Switch models as needed for testing

### Client Demo Workflow
1. Day before: Test OpenAI connection
2. Prepare sample questions
3. Demo day: Verify connection before meeting
4. Have Ollama running as backup
5. Switch seamlessly if needed

### Research Workflow
1. Use Ollama for initial exploration (free)
2. Switch to GPT-4 for final analysis (quality)
3. Document which model gave which insights
4. Compare responses across models

---

## Tips for Each Provider

### Ollama Tips
- Keep models updated: `ollama pull <model>`
- List installed models: `ollama list`
- Remove unused models: `ollama rm <model>`
- Check logs: `ollama logs`

### LM Studio Tips
- Download models while working (background)
- Use "Load Model" to switch quickly
- Check GPU usage in Activity Monitor
- Adjust context length for performance

### OpenAI Tips
- Monitor usage in OpenAI dashboard
- Set up usage alerts
- Use GPT-3.5-turbo for testing
- Use GPT-4 for production
- Check rate limits

### Groq Tips
- Free tier is generous but has limits
- Very fast - great for demos
- Monitor rate limits
- Upgrade if you hit limits

---

## Troubleshooting Common Scenarios

### "Connection failed" with Ollama
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama
ollama serve

# Test manually
curl http://localhost:11434/api/tags
```

### "Connection failed" with LM Studio
1. Open LM Studio
2. Go to Local Server tab (→)
3. Check if server is running (green indicator)
4. Click "Stop" then "Start"
5. Verify port number (usually 1234)

### "Empty content" error
- Model might not be loaded
- Try a different model
- Check provider's logs
- Restart the server

### Slow responses
- Use a smaller model
- Close other applications
- Check GPU usage
- Reduce context length

---

## Best Practices

1. **Always test before important work**
   - Click "🔌 Test Connection"
   - Send a test message
   - Verify quality

2. **Have a backup provider**
   - Primary: Local (Ollama/LM Studio)
   - Backup: Cloud (OpenAI/Groq)

3. **Match model to task**
   - Testing: Small, fast models
   - Production: Large, quality models
   - Demos: Reliable, tested models

4. **Monitor costs**
   - Check OpenAI dashboard regularly
   - Set up billing alerts
   - Use local for development

5. **Keep models updated**
   - Ollama: `ollama pull <model>`
   - LM Studio: Check for updates
   - Try new models regularly

---

## Quick Reference

### Switching Providers (30 seconds)
1. Settings
2. Select provider from dropdown
3. Test Connection
4. Close Settings

### Adding a New Model (2 minutes)
**Ollama:**
```bash
ollama pull <model-name>
```

**LM Studio:**
1. Search → Find model → Download
2. Local Server → Select model → Start

### Testing a Configuration (10 seconds)
1. Settings
2. Click "🔌 Test Connection"
3. Look for "✓ Connected successfully"

---

For more details, see:
- [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md) - Complete setup guide
- [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md) - Provider comparison
- [QUICK_START_LM_STUDIO.md](QUICK_START_LM_STUDIO.md) - LM Studio quick start

