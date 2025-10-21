# Getting Started with Multi-Provider Support

Welcome! GeoAI MetaPanel now supports multiple LLM providers. This guide will get you started in 5 minutes.

## 🚀 Quick Start (Choose Your Path)

### Path 1: LM Studio (Easiest - Recommended for Beginners)
**Time: 5 minutes | Cost: Free | Difficulty: ⭐☆☆☆☆**

1. Download [LM Studio](https://lmstudio.ai)
2. Open LM Studio → Search → Download "llama-3.1-8b"
3. Go to Local Server tab (→) → Start Server
4. Open GeoAI MetaPanel → Settings → Select "LM Studio"
5. Click "🔌 Test Connection" → Should see "✓ Connected"
6. Done! Start chatting.

**Why this path?** Easiest setup, visual interface, great for first-time users.

---

### Path 2: Ollama (Best for Developers)
**Time: 5 minutes | Cost: Free | Difficulty: ⭐⭐☆☆☆**

1. Install [Ollama](https://ollama.ai)
2. Open terminal:
   ```bash
   ollama pull llama3.1
   ollama serve
   ```
3. Open GeoAI MetaPanel → Settings → Select "Ollama"
4. Click "🔌 Test Connection" → Should see "✓ Connected"
5. Done! Start chatting.

**Why this path?** More control, scriptable, huge model library.

---

### Path 3: OpenAI (Best Quality)
**Time: 3 minutes | Cost: Paid | Difficulty: ⭐☆☆☆☆**

1. Sign up at [OpenAI](https://platform.openai.com)
2. Generate API key + add billing
3. Open GeoAI MetaPanel → Settings → Select "OpenAI API"
4. Paste API key → Set model to "gpt-4"
5. Click "🔌 Test Connection" → Should see "✓ Connected"
6. Done! Start chatting.

**Why this path?** Highest quality, no hardware needed, very fast.

---

## 📖 What's New?

### Before (Ollama Only)
- Only worked with Ollama
- Manual configuration
- No connection testing
- Fixed to one provider

### Now (Multi-Provider)
- ✅ Works with Ollama, LM Studio, OpenAI, and more
- ✅ Quick presets for common setups
- ✅ One-click connection testing
- ✅ Easy provider switching
- ✅ See available models
- ✅ Per-persona model assignment

---

## 🎯 Key Features

### 1. Provider Presets
Quick selection of common configurations:
- **Ollama** → localhost:11434
- **LM Studio** → localhost:1234
- **OpenAI** → api.openai.com
- **Custom** → Your own endpoint

### 2. Connection Testing
Click "🔌 Test Connection" to verify:
- ✓ Server is reachable
- ✓ Authentication works
- ✓ Models are available

### 3. Model Discovery
Click "🔄 Refresh" to:
- Load available models
- See what's installed
- Pick the right model

### 4. Per-Persona Models
Assign different models to different personas:
- Maya → mistral (creative)
- Otto → deepseek (analytical)
- Sarah → llama3.1 (balanced)

---

## 🎨 Using the New Interface

### Opening Settings
1. Click **Settings** button (top right)
2. Settings panel slides down

### Selecting a Provider
1. Find **LLM Provider** dropdown
2. Choose from:
   - Ollama (localhost:11434)
   - LM Studio (localhost:1234)
   - OpenAI API
   - Custom Configuration

### Testing Your Setup
1. Click **🔌 Test Connection**
2. Wait for result:
   - ✓ Green = Success
   - ✗ Red = Failed (check error message)

### Loading Models
1. Click **🔄 Refresh** next to Default Model
2. Available models appear below
3. Select your preferred model

### Configuring Per-Persona Models
1. Scroll to **Per-persona model overrides**
2. See list of available models
3. Enter model name for each persona
4. Leave blank to use default

---

## 📚 Documentation Guide

We've created comprehensive documentation to help you:

### For Quick Setup
- **[QUICK_START_LM_STUDIO.md](QUICK_START_LM_STUDIO.md)** - 5-minute LM Studio guide
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - This file

### For Detailed Information
- **[LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md)** - Complete setup for all providers
- **[PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md)** - Compare providers
- **[USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)** - Real-world examples

### For Technical Details
- **[MULTI_PROVIDER_CHANGES.md](MULTI_PROVIDER_CHANGES.md)** - Technical changes
- **[README.md](README.md)** - Updated main README

---

## 🤔 Which Provider Should I Choose?

### Choose LM Studio if:
- ✅ You're new to LLMs
- ✅ You want a visual interface
- ✅ You want easy model management
- ✅ You prefer clicking over typing

### Choose Ollama if:
- ✅ You're comfortable with command line
- ✅ You want more control
- ✅ You want to script/automate
- ✅ You want the largest model selection

### Choose OpenAI if:
- ✅ You need the highest quality
- ✅ You don't have good hardware
- ✅ You're okay with paying
- ✅ You need reliability for demos

### Choose Groq if:
- ✅ You need speed
- ✅ You want free cloud inference
- ✅ You're prototyping
- ✅ You want OpenAI alternative

**Still unsure?** Start with **LM Studio** - it's the easiest!

---

## 💡 Pro Tips

### Tip 1: Have a Backup
Set up two providers:
- **Primary:** Local (Ollama/LM Studio) for daily work
- **Backup:** Cloud (OpenAI/Groq) for when you need it

### Tip 2: Test Before Important Work
Always click "🔌 Test Connection" before:
- Client demos
- Presentations
- Important research

### Tip 3: Use Smaller Models for Testing
- Development: phi-3-mini, llama3.1:8b
- Production: llama3.1, mistral, gpt-4

### Tip 4: Monitor Costs
If using paid APIs:
- Set up billing alerts
- Use GPT-3.5 for testing
- Use GPT-4 for production

### Tip 5: Keep Models Updated
- Ollama: `ollama pull <model>`
- LM Studio: Check for updates regularly
- Newer versions often perform better

---

## 🔧 Troubleshooting

### "Connection failed"
1. Check if server is running
2. Verify base URL is correct
3. Try clicking "Stop" then "Start" in server
4. Check firewall settings

### "Empty content"
1. Make sure model is loaded
2. Try a different model
3. Check server logs
4. Restart server

### Slow responses
1. Use a smaller model
2. Close other applications
3. Check GPU usage
4. Reduce context length

### Can't see models
1. Click "🔄 Refresh"
2. Make sure server is running
3. Check that models are installed
4. Restart server

---

## 🎓 Learning Path

### Week 1: Get Started
- [ ] Choose a provider (recommend LM Studio)
- [ ] Complete quick start
- [ ] Send your first message
- [ ] Try different questions

### Week 2: Explore
- [ ] Try a different provider
- [ ] Test multiple models
- [ ] Experiment with per-persona models
- [ ] Read the setup guide

### Week 3: Optimize
- [ ] Find your favorite model
- [ ] Set up backup provider
- [ ] Configure per-persona models
- [ ] Optimize for your use case

### Week 4: Master
- [ ] Try all providers
- [ ] Compare quality and speed
- [ ] Set up custom endpoints
- [ ] Share your setup with others

---

## 🆘 Getting Help

### Documentation
1. Check [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md) for detailed setup
2. See [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) for examples
3. Read [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md) to compare

### Provider-Specific Help
- **Ollama:** https://ollama.ai/docs
- **LM Studio:** https://lmstudio.ai/docs
- **OpenAI:** https://platform.openai.com/docs

### Common Issues
- Connection problems → Check server is running
- Quality issues → Try a different model
- Speed issues → Use smaller model
- Cost issues → Switch to local provider

---

## 🎉 You're Ready!

You now have everything you need to use GeoAI MetaPanel with multiple LLM providers.

**Next steps:**
1. Choose your provider (LM Studio recommended)
2. Follow the quick start above
3. Start chatting with the AI panel
4. Explore different models and providers

**Remember:**
- Settings are saved automatically
- You can switch providers anytime
- Test connection before important work
- Have fun exploring!

---

## 📞 Quick Reference

### Start LM Studio Server
1. Open LM Studio
2. Local Server tab (→)
3. Start Server

### Start Ollama Server
```bash
ollama serve
```

### Test Connection
1. Settings
2. 🔌 Test Connection
3. Look for ✓

### Switch Providers
1. Settings
2. Select from dropdown
3. Test Connection
4. Close Settings

### Load Models
1. Settings
2. 🔄 Refresh
3. See available models

---

**Happy chatting! 🚀**

For more details, explore the other documentation files in this repository.

