# Video Conference Experience - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### 1. Run the App
```bash
npm run dev
```

### 2. Experience the Features
- **Grid View**: See all personas in equal-sized tiles
- **Speaker View**: Watch as the active speaker takes center stage
- **Animations**: Notice breathing, blinking, and lip-sync movements

### 3. Customize (Optional)
- Click **Settings** → **Avatar Generation** → Generate placeholder avatars
- Click **Settings** → **Accessibility** → Enable reduced motion if needed
- Click the **🎬/📊 button** in header to toggle layout modes

---

## 🎭 What's New?

### Animated Avatars
Every persona now has lifelike animations:
- 🫁 **Breathing**: Subtle chest movement
- 👁️ **Blinking**: Random eye blinks every 2-6 seconds
- 🗣️ **Lip-Sync**: Mouth moves with speech
- 💫 **Micro-movements**: Slight body sway and head tilt

### Video Conference Layout
Two dynamic modes that switch automatically:
- 🎬 **Speaker Mode**: Large speaker + small thumbnails (when someone talks)
- 📊 **Grid Mode**: Equal tiles for everyone (when idle or asking questions)

### AI Avatar Generation
Generate alternative avatars based on persona descriptions:
- 🎨 **Placeholder**: Instant generation (no API key needed)
- 🤖 **AI Ready**: DALL-E and Stable Diffusion support (coming soon)

---

## 🎮 Controls

| Action | How To |
|--------|--------|
| Toggle Layout | Click 🎬/📊 button in header |
| Skip Speaker | Click "Skip ⏭" button (appears when speaking) |
| Play Intro | Click 🎤 button on any persona |
| Open Settings | Click "Settings" button in header |
| Generate Avatars | Settings → Avatar Generation → Generate |
| Reduce Motion | Settings → Accessibility → Enable checkbox |

---

## 🎨 Layout Modes Explained

### Speaker Mode (🎬)
```
┌─────────────────────────────────────┐
│                                     │
│         [Large Speaker]             │
│         Name & Bio                  │
│         Model Badge                 │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ [👤] [👤] [👤] [👤]  ← Thumbnails   │
└─────────────────────────────────────┘
```

### Grid Mode (📊)
```
┌──────────┬──────────┬──────────┐
│   [👤]   │   [👤]   │   [👤]   │
│  Name    │  Name    │  Name    │
│  Badge   │  Badge   │  Badge   │
├──────────┼──────────┼──────────┤
│   [👤]   │   [👤]   │          │
│  Name    │  Name    │          │
│  Badge   │  Badge   │          │
└──────────┴──────────┴──────────┘
```

---

## 🎯 Key Features at a Glance

### Animations
- ✅ Breathing motion (3s cycle)
- ✅ Random blinking (2-6s intervals)
- ✅ Lip-sync with audio
- ✅ Speaking glow effect
- ✅ Micro-movements (sway, tilt)

### Layout
- ✅ Auto-switch on speaking
- ✅ Manual toggle available
- ✅ Smooth transitions
- ✅ Responsive design
- ✅ Dark professional theme

### Accessibility
- ✅ Reduced motion support
- ✅ System preference detection
- ✅ Manual toggle
- ✅ Keyboard navigation
- ✅ Screen reader friendly

---

## 🔧 Troubleshooting

### Animations not working?
- Check if "Reduce motion" is enabled in Settings
- Verify browser supports CSS animations (Chrome 90+, Firefox 88+, Safari 14+)

### Layout not switching?
- Ensure TTS is working (audio must play for amplitude detection)
- Check browser console for errors

### Generated avatars not loading?
- Check internet connection (placeholder service requires internet)
- Try clicking "Generate" button again

---

## 📱 Responsive Design

### Desktop (>768px)
- Speaker mode: Large speaker + vertical thumbnail strip
- Grid mode: 3-column grid

### Mobile (<768px)
- Speaker mode: Large speaker + horizontal thumbnail strip
- Grid mode: 2-column grid

---

## ⚡ Performance Tips

1. **Enable GPU Acceleration**: Already enabled by default
2. **Reduce Motion**: Enable if experiencing lag
3. **Close Other Tabs**: For best performance
4. **Use Modern Browser**: Chrome/Edge recommended

---

## 🎓 For Developers

### Component Structure
```
App.tsx
├── VideoConferenceLayout.tsx
│   ├── AnimatedAvatar.tsx (Speaker)
│   └── AnimatedAvatar.tsx (Thumbnails/Grid)
└── Settings Panel
    └── Avatar Generation Controls
```

### Key Files
- `src/components/AnimatedAvatar.tsx` - Avatar animations
- `src/components/VideoConferenceLayout.tsx` - Layout logic
- `src/services/avatarGenerator.ts` - Avatar generation
- `src/styles.css` - Video conference styles

### State Management
- `layoutMode`: 'speaker' | 'grid'
- `audioAmplitudes`: Record<string, number>
- `generatedAvatars`: Record<string, string>
- `reduceMotion`: boolean

---

## 🎬 Demo Scenarios

### Scenario 1: Panel Discussion
1. Start app → Grid mode shows all personas
2. Ask: "What are the ethical concerns with GeoAI?"
3. Personas respond one by one
4. Layout auto-switches to speaker mode for each
5. Watch lip-sync and animations

### Scenario 2: Custom Avatars
1. Open Settings
2. Enable "Use AI-generated placeholder avatars"
3. Click "Generate Placeholder Avatars"
4. Watch as avatars update with colorful alternatives

### Scenario 3: Accessibility
1. Open Settings
2. Enable "Reduce motion"
3. Notice animations stop
4. Functionality remains intact

---

## 📚 Additional Resources

- **Full Documentation**: See `VIDEO_CONFERENCE_FEATURES.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Architecture Diagram**: Rendered in implementation summary

---

## 🎉 Enjoy!

You now have a fully immersive video conference experience with:
- 🎭 Lifelike animated avatars
- 🎬 Intelligent layout switching
- 🗣️ Real-time lip-sync
- 🎨 AI avatar generation
- ♿ Full accessibility support

**Have fun exploring the GeoAI MetaPanel!**

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-15  
**Status**: Production Ready ✅

