# Time Warp

Time Warp is an installable iPhone performance utility for the lock-screen time-reversal effect. A secretly chosen number of minutes is loaded, the fake lock screen appears that many minutes in the future, then rewinds minute by minute until it reaches the real current time.

## Revamped setup

Setup is deliberately compact and split into **Display**, **Input**, and **Timing**.

- **Display** opens a dedicated full-screen lock-screen editor. Drag the clock and date independently, style each one, upload/replace and position the wallpaper, and add a separate reference-image overlay. The floating editor can live at the top or bottom. **Preview** removes every editor control so the exact performance composition can be checked.
- **Input** offers invisible tap zones, Clipboard, iPhone Shortcut URL, direct number entry, and the optional experimental Calculator. Tap-zone boundaries and increments are editable, with either a dedicated confirm zone or automatic confirmation on the third tap. The initial cover is optional and can use a custom image instead of black.
- **Timing** controls the hold before the rewind and the rewind speed, plus the Calculator disguise switch.

Settings are saved in `localStorage`. Wallpaper, reference, and cover images are stored locally in IndexedDB; they are not uploaded by the app.

## Input methods

### Invisible tap zones

Four adjustable zones add configurable increments. The bottom confirm band can reveal the lock screen, or the app can reveal automatically after three increment taps.

### Clipboard

Clipboard content is parsed and validated before reveal. If automatic clipboard access is blocked by iOS, Time Warp provides a manual paste fallback while keeping the fake lock screen hidden.

### iPhone Shortcut URL

Use either:

`https://magicaleb.github.io/Time-warp/?minutes=NUMBER`

or:

`https://magicaleb.github.io/Time-warp/#minutes=NUMBER`

The value must be a whole number from 1 through 180. Time Warp removes the secret value from the visible URL after reading it.

### Direct entry

Useful for rehearsal and controlled performances.

### Experimental Calculator

Enable the disguise in **Timing**, then select Calculator as the input method. The calculator handles ordinary arithmetic. A normal tap on `=` calculates; holding `=` for 0.7 seconds secretly captures the last number entered and loads it as the chosen minutes.

## Performance controls

- The lock screen fades in on reveal.
- Two-finger swipe down returns from performance mode to setup.
- In editor Preview, the same gesture returns to editing.
- 24-hour time, date visibility, date format, hold duration, and rewind speed are configurable.
- Flashlight and camera graphics are intentionally not drawn because the intended uploaded screenshot can already contain them.

For the cleanest iPhone presentation, install from Safari using **Add to Home Screen**.
