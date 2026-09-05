# Time Warp

Time Warp is an installable iPhone performance utility. It presents a personalized lock screen at a secretly chosen number of minutes in the future, then rewinds minute by minute to the real time.

## Setup

The app opens to three compact settings pages:

- **Display** opens a full-screen wallpaper editor. Drag the clock and date into position, then adjust each element's style, size, thickness, color, and opacity in the floating controls. **Preview** hides the editing controls and uses the exact performance view.
- **Input** selects tap zones, Clipboard, a Shortcut link, a visible number field, or the optional experimental Calculator. The cover screen is optional and can be black or use a saved image.
- **Timing** sets the hold and rewind pace and enables the experimental Calculator input.

Wallpaper, reference screenshot, cover image, appearance, timing, and input choices stay on the device. Images are stored in IndexedDB and are not uploaded.

## Performance

### Tap zones

The default invisible zones add 1, 2, 5, or 10; the bottom area confirms. Their boundaries and values are editable. Turning off the cover shows the map while entering.

### Clipboard

With a cover enabled:

1. Start the performance.
2. Run a Shortcut that copies the chosen whole number to the clipboard.
3. Return to Time Warp and tap the cover.
4. The app reads and validates the clipboard before it shows the lock screen. WebKit may display a system **Paste** prompt.

Without a cover, **Paste & perform** reads the clipboard while the setup button is pressed. If programmatic access is unavailable, the app offers a normal paste field. A failed or invalid read never reveals the lock screen.

### Shortcut link

Pass a whole number from 1 through 180 in the URL:

https://magicaleb.github.io/Time-warp/#minutes=NUMBER

The app removes the number from the visible URL as soon as it reads it. A link opened from Shortcuts may open Safari rather than the installed Home Screen app; Clipboard is the reliable bridge back into an already-open PWA.

### Calculator experiment

Enable **Calculator disguise** under Timing, then choose Calculator as the input. It performs ordinary arithmetic. Holding the equals button for 0.7 seconds secretly loads the last number entered, even after showing a calculated result. A normal tap on equals behaves normally.

## Controls

- Two-finger swipe down from any performance screen returns to setup.
- A cover tap reveals a preloaded Number, Shortcut, or Calculator value.
- The revealed clock fades in before the configured hold and rewind begin.

Use Safari's **Add to Home Screen** for the app-style presentation. The PWA works offline after its shell is cached.
