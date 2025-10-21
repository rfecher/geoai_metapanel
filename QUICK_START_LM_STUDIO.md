# Quick Start: Using LM Studio with GeoAI MetaPanel

This guide will get you up and running with LM Studio in under 5 minutes.

## Step 1: Install LM Studio

1. Download LM Studio from [https://lmstudio.ai](https://lmstudio.ai)
2. Install and launch the application

## Step 2: Download a Model

1. In LM Studio, click the **🔍 Search** icon (left sidebar)
2. Search for a model (recommended starters):
   - `llama-3.1-8b` - Good balance of speed and quality
   - `mistral-7b` - Fast and creative
   - `phi-3-mini` - Very fast, smaller model
3. Click **Download** on your chosen model
4. Wait for the download to complete

## Step 3: Start the Local Server

1. Click the **→** icon (Local Server) in the left sidebar
2. Select your downloaded model from the dropdown
3. Click **Start Server**
4. Note the server address (usually `http://localhost:1234`)

## Step 4: Configure GeoAI MetaPanel

1. Launch GeoAI MetaPanel
2. Click **Settings** button
3. In the **LLM Provider** dropdown, select **LM Studio (localhost:1234)**
4. Click **🔌 Test Connection** - you should see "✓ Connected successfully"
5. Click **🔄 Refresh** to load available models
6. The **Default Model** field should auto-populate with your loaded model
7. Close Settings

## Step 5: Start Chatting!

1. Type a question in the input box (or use the default question)
2. Click **Send** or press Enter
3. Watch as each persona responds with their unique perspective

## Tips for Best Results

### Model Selection
- **For speed:** Use 7B or smaller models (phi-3-mini, llama-3.1-8b)
- **For quality:** Use 13B+ models if your hardware supports it
- **For creativity:** Try Mistral or Mixtral models

### Performance Optimization
- **GPU Acceleration:** LM Studio automatically uses your GPU if available
- **Context Length:** In LM Studio server settings, adjust context length based on your RAM
- **Batch Size:** Increase for faster processing if you have enough VRAM

### Switching Models on the Fly
1. In LM Studio, stop the current server
2. Select a different model
3. Start the server again
4. In GeoAI MetaPanel, click **🔄 Refresh** to update the model list
5. No need to restart the app!

### Using Different Models for Different Personas

You can assign different models to different personas:

1. In LM Studio, note the exact model identifier shown in the server tab
2. In GeoAI MetaPanel Settings, scroll to **Per-persona model overrides**
3. Enter different model names for different personas
4. Example:
   - **Default Model:** `llama-3.1-8b`
   - **Maya Ríos:** `mistral-7b` (more creative/empathetic)
   - **Otto Reinhardt:** `phi-3-mini` (faster, more analytical)

**Note:** To use multiple models simultaneously, you'll need to run multiple LM Studio instances on different ports, or switch models between responses.

## Troubleshooting

### "Connection failed" Error
- ✅ Make sure LM Studio's server is running (green indicator)
- ✅ Check the port number matches (default: 1234)
- ✅ Try clicking **Stop Server** then **Start Server** in LM Studio

### "Empty content" Error
- ✅ Make sure a model is loaded in LM Studio
- ✅ Check LM Studio's console for error messages
- ✅ Try a different model

### Slow Responses
- ✅ Use a smaller model (7B or less)
- ✅ Close other applications to free up RAM/VRAM
- ✅ In LM Studio, reduce context length in server settings
- ✅ Enable GPU acceleration in LM Studio settings

### Model Not Showing Up
- ✅ Click **🔄 Refresh** in GeoAI MetaPanel
- ✅ Make sure the model is loaded (not just downloaded) in LM Studio
- ✅ Restart the LM Studio server

## Comparing with Ollama

| Feature | LM Studio | Ollama |
|---------|-----------|--------|
| **GUI** | ✅ Full GUI | ❌ Command-line |
| **Model Management** | ✅ Visual browser | ⚠️ Terminal commands |
| **Ease of Use** | ✅ Very easy | ⚠️ Moderate |
| **Model Switching** | ✅ Click to switch | ⚠️ Command to pull |
| **Performance** | ✅ Optimized | ✅ Optimized |
| **Model Selection** | ⚠️ Curated list | ✅ Full Ollama library |
| **API Compatibility** | ✅ OpenAI-compatible | ⚠️ Ollama-specific |

**Recommendation:** Use LM Studio if you prefer a GUI and want easy model management. Use Ollama if you prefer command-line tools and want access to the full model library.

## Next Steps

- Try different models to see which works best for your use case
- Experiment with per-persona model assignments
- Check out the full [LLM_SETUP_GUIDE.md](LLM_SETUP_GUIDE.md) for more advanced configurations
- Explore other providers like OpenAI or Groq for cloud-based inference

## Recommended Models for GeoAI Discussions

Based on the technical nature of GeoAI topics, here are recommended models:

1. **llama-3.1-8b-instruct** - Best all-around choice
   - Good technical knowledge
   - Balanced speed and quality
   - Works well on most hardware

2. **mistral-7b-instruct** - Creative and nuanced
   - Great for diverse perspectives
   - Fast inference
   - Good for Maya and Sarah personas

3. **deepseek-coder-7b** - Technical and analytical
   - Strong coding and technical knowledge
   - Good for Otto and Marcus personas
   - Excellent for GeoAI implementation details

4. **phi-3-mini** - Fast prototyping
   - Very fast responses
   - Good for testing and demos
   - Lower quality but acceptable for quick iterations

5. **mixtral-8x7b** - High quality (if you have the hardware)
   - Excellent reasoning
   - Best quality responses
   - Requires 32GB+ RAM

## Getting Help

- **LM Studio Discord:** Join for model recommendations and troubleshooting
- **LM Studio Docs:** [https://lmstudio.ai/docs](https://lmstudio.ai/docs)
- **GeoAI MetaPanel Issues:** Check the GitHub repository

Happy chatting! 🚀

