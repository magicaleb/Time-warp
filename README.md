# Time Warp — Magic Trick PWA
A Progressive Web App for iPhone that simulates a fake lock screen clock for use
in a magic trick.
## The Trick
1. Spectator names any number between 5 and 15
2. Magician "wakes" their phone with a few taps
3. Lock screen appears showing current time **plus** the chosen number of minutes
4. After a dramatic pause, the clock ticks backwards, minute by minute
5. It lands exactly on the real current time — matching every clock in the room
## Secret Input System
The phone shows a black screen (appears off). The magician taps invisible
quadrants to silently encode the number:
```
┌─────────────┬─────────────┐
│ TL = +1 │ TR = +2 │ ← top third
├─────────────┼─────────────┤
│ BL = +5 │ BR = +10 │ ← middle third
├─────────────────────────────┤
│ CONFIRM / WAKE │ ← bottom third
└─────────────────────────────┘
```
- Taps **add together** (BR + BL = 10 + 5 = 15)
- Tap bottom third at any time to confirm and wake the phone
- After **3 taps** in the input zone, auto-confirms (no confirm tap needed)
- Looks like someone fumbling to wake their phone
### Reachable Numbers
| Number | Taps |
|--------|------|
| 5 | BL |
| 6 | TL + BL |
| 7 | TR + BL |
| 8 | TL + TR + BL *(auto-confirms)* |
| 9 | Not cleanly reachable — use a force |
| 10 | BR |
| 11 | TL + BR |
| 12 | TR + BR |
| 13 | TL + TR + BR *(auto-confirms)* |
| 14 | Not cleanly reachable — use a force |
| 15 | BL + BR |
> **Tip:** Use a psychological force to steer spectators toward 10 (most common
free choice in this range), or prepare a mathematical force.
## File Structure
```
timewarp/
├── index.html ← main app (rename timewarp.html → index.html)
├── manifest.json ← PWA manifest
├── sw.js ← service worker (offline caching)
├── icon-192.png ← app icon (192×192)
├── icon-512.png ← app icon (512×512)
└── README.md
```
## Deployment
1. Push all files to a GitHub repository
2. Enable **GitHub Pages** (Settings → Pages → Deploy from branch → main)
3. Your app will be live at `https://yourusername.github.io/timewarp/`
4. On your iPhone, open the URL in **Safari**
5. Tap **Share → Add to Home Screen** → name it something innocent like "Clock"
6. Open from home screen — must be installed as PWA for true full-screen mode
## One-Time Setup (Before First Performance)
1. Open the app from your home screen
2. **Upload your wallpaper** — use your lock screen background photo *without* the
clock (use your original wallpaper image, not a screenshot with the time visible)
3. Tap **Open Edit Mode** — your wallpaper loads with a yellow box around the
clock
4. **Drag** the clock to match the exact position on your real lock screen
5. Use **Size** and **Weight** controls to match the font exactly
6. Tap **✓ Save & Back** — settings are saved and persist between sessions
7. Set your preferred **timing** (delay before rewind, rewind speed)
> **Note:** The wallpaper must be re-uploaded each session (too large for
localStorage). Clock position, size, and weight are saved permanently.
## Performance Flow
```
Setup screen → [Launch →] → Black screen (enter number) → Lock screen → Rewind →
Done
```
- **Secret reset:** Triple-tap the top-left corner of the lock screen to reveal a
reset button
## Technical Notes
- Pure vanilla HTML/CSS/JS — zero dependencies, no build step
- Single `index.html` contains all HTML, CSS, and JavaScript
- Uses `-apple-system` font (resolves to SF Pro Display on iOS) to match real iOS
clock
- Status bar set to `black` style — solid black bar with white text, prevents any
conflict with wallpaper
- Wake Lock API keeps screen on during performance (requires HTTPS)
- Clock display is instant `textContent` swap — no animation, exactly like iOS
## Known Limitations
- Numbers 9 and 14 cannot be reached cleanly with the quadrant system
- Wallpaper must be re-uploaded each session
- Must be installed via Add to Home Screen for full-screen mode
- Wake Lock requires HTTPS and a user gesture
## Future Improvements
- [ ] Persist wallpaper using IndexedDB (no size limit)
- [ ] Multiple saved profiles (different wallpapers / settings)
- [ ] 24-hour clock mode
- [ ] AM/PM display option
- [ ] Subtle haptic feedback on each quadrant tap
- [ ] Optional faint angle-dependent indicator showing running total (visible only
to magician)
- [ ] Mathematical force built into the setup flow