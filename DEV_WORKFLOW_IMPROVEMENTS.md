# Development Workflow Improvements

## Issue: App Doesn't Exit Cleanly

### Problem
When running `npm run dev`, closing the Electron window required:
1. Closing the window once (Electron closes)
2. Closing again or Cmd+Q (macOS behavior)
3. Still needed to manually kill the process (Vite server kept running)

### Root Causes

1. **macOS Behavior**: By default, macOS apps don't quit when the last window closes - they stay in the dock
2. **Concurrently Flag**: The `-r` (restart) flag didn't properly handle process cleanup
3. **No Process Coordination**: Vite and Electron ran independently without cleanup coordination

### Solutions Implemented

#### 1. Smart Window Close Behavior (`electron/main.ts`)

**Before:**
```typescript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**After:**
```typescript
app.on('window-all-closed', () => {
  // In development, always quit when window closes for easier workflow
  // In production, follow macOS convention (keep app running)
  if (process.env.VITE_DEV_SERVER_URL || process.platform !== 'darwin') {
    app.quit();
  }
});
```

**What this does:**
- In **development** (when `VITE_DEV_SERVER_URL` is set): Always quit when window closes
- In **production** on macOS: Follow standard macOS behavior (stay in dock)
- On **Windows/Linux**: Always quit when window closes (standard behavior)

#### 2. Proper Process Cleanup (`package.json`)

**Before:**
```json
"dev": "concurrently -r \"vite\" \"wait-on dist-electron/main.js tcp:5173 && electron .\""
```

**After:**
```json
"dev": "concurrently --kill-others \"vite\" \"wait-on dist-electron/main.js tcp:5173 && electron .\""
```

**What this does:**
- `--kill-others`: When one process exits, kill all other processes
- Removes `-r` (restart): No automatic restart on failure
- Result: When Electron quits, Vite is automatically killed

### How It Works Now

1. **Start Development:**
   ```bash
   npm run dev
   ```
   - Vite starts
   - Electron waits for Vite
   - Electron launches when ready

2. **Close the App:**
   - Click the close button (X) or Cmd+W
   - Electron window closes
   - Electron app quits (because of dev mode check)
   - Concurrently detects Electron exit
   - Concurrently kills Vite
   - All processes terminate cleanly

3. **Result:**
   - ✅ One click to close
   - ✅ No manual process killing
   - ✅ Clean terminal exit

### Testing the Fix

**Test 1: Normal Close**
```bash
npm run dev
# Wait for app to open
# Close the window
# Terminal should exit cleanly
```

**Test 2: Keyboard Shortcut**
```bash
npm run dev
# Wait for app to open
# Press Cmd+W (macOS) or Ctrl+W (Windows/Linux)
# Terminal should exit cleanly
```

**Test 3: Quit Command**
```bash
npm run dev
# Wait for app to open
# Press Cmd+Q (macOS) or Alt+F4 (Windows)
# Terminal should exit cleanly
```

### Benefits

1. **Faster Development Cycle**
   - No need to manually kill processes
   - Restart is just `npm run dev` again
   - No zombie processes

2. **Better Developer Experience**
   - Intuitive behavior (close = quit in dev mode)
   - Clean terminal output
   - No confusion about what's running

3. **Production Behavior Preserved**
   - macOS apps still follow platform conventions in production
   - Only development mode is affected
   - No breaking changes for end users

### Additional Improvements

#### Ctrl+C Handling
The `--kill-others` flag also ensures that pressing Ctrl+C in the terminal:
- Kills both Vite and Electron
- Exits cleanly
- No orphaned processes

#### Error Handling
If either process crashes:
- The other process is automatically killed
- Terminal shows the error
- Clean exit for restart

### Troubleshooting

#### If processes still don't exit:

**Check for zombie processes:**
```bash
# macOS/Linux
ps aux | grep -E "(electron|vite)"

# Kill if found
pkill -f electron
pkill -f vite
```

**Check port availability:**
```bash
# Check if port 5173 is in use
lsof -i :5173

# Kill process using the port
kill -9 <PID>
```

#### If app doesn't quit on close:

1. Check that changes were saved to `electron/main.ts`
2. Restart the dev server: `npm run dev`
3. Verify `VITE_DEV_SERVER_URL` is set (should be automatic)

### Platform-Specific Notes

#### macOS
- **Development**: Closes immediately (new behavior)
- **Production**: Stays in dock (standard macOS behavior)
- **Keyboard**: Cmd+W closes window, Cmd+Q quits app

#### Windows
- **Development**: Closes immediately (unchanged)
- **Production**: Closes immediately (standard Windows behavior)
- **Keyboard**: Ctrl+W closes window, Alt+F4 quits app

#### Linux
- **Development**: Closes immediately (unchanged)
- **Production**: Closes immediately (standard Linux behavior)
- **Keyboard**: Ctrl+W closes window, Alt+F4 quits app

### Related Files

- `electron/main.ts` - Main Electron process
- `package.json` - NPM scripts configuration
- `vite.config.ts` - Vite configuration (unchanged)

### Future Improvements

Potential enhancements:
- [ ] Add graceful shutdown handlers
- [ ] Save state before quit
- [ ] Confirm quit on unsaved work
- [ ] Add "Quit" menu item
- [ ] Add keyboard shortcut hints

### References

- [Electron App Lifecycle](https://www.electronjs.org/docs/latest/api/app#event-window-all-closed)
- [Concurrently Documentation](https://github.com/open-cli-tools/concurrently)
- [macOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos/app-architecture/launching-and-termination/)

---

## Summary

**Problem:** App required multiple closes and manual process killing  
**Solution:** Smart quit behavior in dev mode + proper process cleanup  
**Result:** One click to close, clean exit, no manual cleanup needed

**Try it now:**
```bash
npm run dev
# Close the window - everything exits cleanly!
```

