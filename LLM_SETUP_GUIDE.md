# LLM Provider Setup Guide

GeoAI MetaPanel now supports multiple LLM providers, making it easy to switch between different models and services. This guide will help you set up and use different providers.

## Quick Start

1. Open the app and click **Settings**
2. In the **LLM Provider** dropdown, select your preferred provider
3. Click **🔌 Test Connection** to verify it's working
4. Click **🔄 Refresh** to load available models

## Supported Providers

### 1. Ollama (Default)
**Best for:** Local, private, free inference with open-source models

**Setup:**
```bash
# Install Ollama from https://ollama.ai
# Then pull models you want to use:
ollama pull llama3.1
ollama pull mistral
ollama pull deepseek-r1:7b
ollama pull gemma2

# Start Ollama (usually runs automatically)
ollama serve
```

**Configuration:**
- **Base URL:** `http://localhost:11434`
- **Default Model:** `llama3.1` (or any model you've pulled)
- **API Key:** Not required

**Pros:**
- ✅ Free and open source
- ✅ Runs completely offline
- ✅ Privacy-focused (no data leaves your machine)
- ✅ Wide selection of models

**Cons:**
- ❌ Requires local GPU/CPU resources
- ❌ Slower than cloud APIs on modest hardware

---

### 2. LM Studio
**Best for:** Easy local model management with a GUI

**Setup:**
1. Download and install [LM Studio](https://lmstudio.ai/)
2. In LM Studio, browse and download models you want to use
3. Go to the **Local Server** tab (→ icon)
4. Click **Start Server**
5. Note the port (usually `1234`)

**Configuration:**
- **Base URL:** `http://localhost:1234`
- **Default Model:** The model name shown in LM Studio (e.g., `local-model`)
- **API Key:** Not required

**Pros:**
- ✅ User-friendly GUI for model management
- ✅ Easy to switch between models
- ✅ OpenAI-compatible API
- ✅ Runs completely offline

**Cons:**
- ❌ Requires local GPU/CPU resources
- ❌ Model names can be less predictable

**Tips:**
- In LM Studio, you can see the exact model identifier in the server tab
- Use the **🔄 Refresh** button in GeoAI MetaPanel to see available models
- You can load different models in LM Studio without restarting the app

---

### 3. OpenAI API
**Best for:** Highest quality responses, fastest inference

**Setup:**
1. Sign up at [OpenAI](https://platform.openai.com/)
2. Generate an API key from your account dashboard
3. Add billing information (pay-as-you-go)

**Configuration:**
- **Base URL:** `https://api.openai.com/v1`
- **Default Model:** `gpt-4` or `gpt-3.5-turbo`
- **API Key:** Your OpenAI API key (starts with `sk-`)

**Pros:**
- ✅ Highest quality responses
- ✅ Very fast
- ✅ No local resources needed
- ✅ Latest models

**Cons:**
- ❌ Costs money per token
- ❌ Requires internet connection
- ❌ Data sent to OpenAI servers

**Cost Estimates (as of 2024):**
- GPT-3.5-turbo: ~$0.50-2.00 per session
- GPT-4: ~$5-20 per session
- GPT-4-turbo: ~$2-10 per session

---

### 4. Custom / Other OpenAI-Compatible APIs
**Best for:** Using other cloud providers or custom endpoints

Many services offer OpenAI-compatible APIs:
- **Anthropic Claude** (via proxy)
- **Together.ai**
- **Groq** (very fast inference)
- **Anyscale**
- **Replicate**
- **Local proxies/gateways**

**Setup:**
1. Select **Custom Configuration** from the dropdown
2. Enter the provider's base URL
3. Add your API key if required
4. Enter the model name as specified by the provider

**Example - Groq:**
- **Base URL:** `https://api.groq.com/openai/v1`
- **API Key:** Your Groq API key
- **Model:** `mixtral-8x7b-32768` or `llama2-70b-4096`

---

## Advanced Features

### Per-Persona Model Overrides

You can assign different models to different personas for varied perspectives:

1. Set a **Default Model** (used by all personas by default)
2. In **Per-persona model overrides**, specify different models for specific personas
3. Leave blank to use the default model

**Example Setup:**
- **Default Model:** `llama3.1`
- **Maya Ríos:** `mistral` (more creative)
- **Otto Reinhardt:** `deepseek-r1:7b` (more analytical)
- **Dr. Sarah Chen:** (blank - uses default)

### Mixing Providers

You can even mix providers by:
1. Running multiple local servers (Ollama + LM Studio)
2. Using different ports
3. Switching the base URL as needed

### Testing Your Setup

Always use the **🔌 Test Connection** button to verify:
- ✅ The server is reachable
- ✅ Authentication works (if required)
- ✅ Models are available

If the test fails, check:
- Is the server running?
- Is the base URL correct?
- Is the API key valid?
- Are you behind a firewall/proxy?

---

## Recommended Setups

### For Privacy & Offline Use
**Provider:** Ollama  
**Models:** `llama3.1`, `mistral`, `gemma2`  
**Why:** Everything runs locally, no internet required

### For Best Quality
**Provider:** OpenAI  
**Model:** `gpt-4` or `gpt-4-turbo`  
**Why:** Highest quality responses, worth the cost for important work

### For Speed & Free
**Provider:** Groq (custom)  
**Models:** `mixtral-8x7b-32768`  
**Why:** Very fast inference, generous free tier

### For Experimentation
**Provider:** LM Studio  
**Why:** Easy to download and try different models with a GUI

### For Mixed Approach
**Provider:** Ollama (default)  
**Per-persona overrides:** Use OpenAI's `gpt-4` for one key persona  
**Why:** Balance cost and quality

---

## Troubleshooting

### "Connection failed" error
- Verify the server is running
- Check the base URL (include `http://` or `https://`)
- Try the test connection button
- Check firewall settings

### "Empty content" error
- The model might not be loaded
- Try a different model name
- Check server logs for errors

### Slow responses
- Local models: Check GPU/CPU usage
- Cloud APIs: Check internet connection
- Try a smaller/faster model

### Models not showing up
- Click **🔄 Refresh** to reload the model list
- For Ollama: Run `ollama list` to see installed models
- For LM Studio: Make sure a model is loaded in the server tab

---

## Tips & Best Practices

1. **Start with Ollama** - It's free and works offline
2. **Test before a demo** - Always verify your setup works
3. **Use smaller models for testing** - Save time during development
4. **Monitor costs** - If using paid APIs, check usage regularly
5. **Keep models updated** - Newer versions often perform better
6. **Experiment with per-persona models** - Different models can provide unique perspectives

---

## Model Recommendations by Use Case

### For GeoAI/Technical Discussions
- `llama3.1` - Good general knowledge
- `deepseek-r1:7b` - Strong reasoning
- `mixtral-8x7b` - Good balance

### For Creative/Diverse Perspectives
- `mistral` - Creative and nuanced
- `gemma2` - Balanced and thoughtful

### For Fast Prototyping
- `llama3.1:8b` - Fast, decent quality
- `phi3` - Very fast, smaller model

### For Production/Demos
- `gpt-4` - Best quality
- `gpt-4-turbo` - Fast and high quality
- `claude-3-opus` - Excellent reasoning (via proxy)

---

## Need Help?

- **Ollama Docs:** https://ollama.ai/docs
- **LM Studio:** https://lmstudio.ai/docs
- **OpenAI API:** https://platform.openai.com/docs

For issues with GeoAI MetaPanel, check the main README.md or open an issue on GitHub.

