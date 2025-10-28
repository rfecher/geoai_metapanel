# Backup System Quick Start Guide

## What is the Backup System?

The backup/fallback system provides pre-generated responses when your AI models are unavailable. This ensures your application continues to work even during:
- API failures
- Network outages
- Service interruptions
- Demo presentations without live AI

## Quick Setup

### 1. Access Settings
Click the ⚙️ Settings button in the application

### 2. Find Backup Settings
Scroll to the **📦 Backup/Fallback System** section

### 3. Choose Your Mode

**Disabled** - No backup responses
- Use when you always want live AI responses
- Errors will show generic fallback messages

**Auto** (Recommended) - Enable after failures
- Automatically activates after 2 consecutive LLM failures
- Automatically deactivates when LLM recovers
- Best for production use

**Always** - Always use backup responses
- Perfect for demos and presentations
- No LLM required
- Instant responses

## Testing the System

### Test 1: Auto Mode
```
1. Set mode to "Auto"
2. Stop your LLM service (e.g., stop Ollama)
3. Ask any question twice
4. Watch status change to "Active"
5. Subsequent questions use backup responses
6. Restart LLM service
7. Next question returns to live AI
```

### Test 2: Demo Mode
```
1. Set mode to "Always"
2. Ask: "What are the technical bottlenecks in LLM+GeoAI integration?"
3. Get instant pre-generated responses from all personas
4. No LLM needed!
```

## Available Demo Questions

The system has pre-generated responses for these topics:

1. **Technical Bottlenecks**
   - "What are the technical bottlenecks in LLM+GeoAI integration?"
   - Keywords: bottleneck, integration

2. **Model Selection**
   - "How do you select models for LIDAR processing?"
   - Keywords: model, select, lidar

3. **Data Sovereignty**
   - "What's the best architecture for data sovereignty?"
   - Keywords: sovereignty, data privacy

4. **Community Model**
   - "How can we develop a community PostGIS LLM?"
   - Keywords: community, postgis

5. **Debugging Approach**
   - "What's your approach to debugging geometry processing?"
   - Keywords: debug, geometry

6. **Future Architecture**
   - "How will geospatial AI architecture evolve?"
   - Keywords: future, architecture

## Status Indicators

Watch the status display to understand what's happening:

- **"Backup mode: Ready"** - Auto mode, no failures yet
- **"Backup mode: Monitoring (1/2 failures)"** - Tracking failures
- **"Backup mode: Active (2 failures detected)"** - Using backups
- **"Backup mode: Always active"** - Always mode enabled
- **"Backup mode: Disabled"** - No backup support

## Common Use Cases

### Use Case 1: Development
**Scenario**: Working on UI without running LLM
**Solution**: Set to "Always" mode
**Benefit**: Instant responses, no LLM overhead

### Use Case 2: Production
**Scenario**: Deployed app with occasional LLM issues
**Solution**: Set to "Auto" mode
**Benefit**: Automatic failover and recovery

### Use Case 3: Presentation
**Scenario**: Demo at conference without internet
**Solution**: Set to "Always" mode
**Benefit**: Reliable, instant responses

### Use Case 4: Testing
**Scenario**: Testing UI without AI costs
**Solution**: Set to "Always" mode
**Benefit**: No API costs, fast iteration

## Troubleshooting

### Backup responses not working?
1. Check that mode is set to "Auto" or "Always"
2. Verify status shows "Active" or "Always active"
3. Check browser console for errors
4. Ensure `public/demo-backup/` folder exists with JSON files

### Generic responses instead of specific ones?
- Your question doesn't match any demo topics
- Try asking one of the demo questions listed above
- Generic responses are persona-specific and still useful

### Status not updating?
- Refresh the page
- Check browser console for errors
- Verify backup service is imported correctly

## Advanced Configuration

### Change Failure Threshold
Edit `src/services/backup.ts`:
```typescript
autoEnableThreshold: 2, // Change this number
```

### Add Custom Backup Responses
1. Create new JSON file in `public/demo-backup/`
2. Follow existing format (see q1-technical-bottlenecks.json)
3. Add to DEMO_QUESTIONS in `demo-backup/backup-loader.ts`
4. Update matching logic if needed

### Adjust Streaming Speed
Edit `src/services/backup.ts`:
```typescript
delayMs: 30 // Milliseconds between words
```

## Tips & Best Practices

1. **Use Auto Mode in Production** - Best balance of reliability and live AI
2. **Test Backup Responses** - Ensure they're relevant and high-quality
3. **Monitor Status** - Watch for frequent backup activation (indicates LLM issues)
4. **Update Regularly** - Keep backup responses current with your domain
5. **Customize Generic Fallbacks** - Make them persona-specific and helpful

## Integration with Other Features

### Works With:
- ✅ Streaming responses (simulated)
- ✅ Text-to-Speech (TTS)
- ✅ All personas (Maya, Otto, Sarah, Marcus, Jessica)
- ✅ Video conference layout
- ✅ Message history
- ✅ Acknowledgments

### Limitations:
- ❌ Addendums (not generated for backup responses)
- ❌ Context awareness (backup responses are pre-generated)
- ❌ Dynamic follow-ups (responses are static)

## Need Help?

Check the full documentation in `BACKUP_SYSTEM_IMPLEMENTATION.md` for:
- Detailed architecture
- Component descriptions
- API reference
- Customization guide
- Future enhancements

## Summary

The backup system is your safety net for reliable AI interactions. Set it to "Auto" mode and forget about it - it will automatically handle failures and recovery. For demos and development, use "Always" mode for instant, reliable responses without any AI service running.

**Recommended Setting**: Auto mode (default)
**For Demos**: Always mode
**For Testing**: Always mode
**For Production**: Auto mode

