# Time Warp — iPhone Lock-Screen Magic

Time Warp is an installable phone magic utility. A spectator freely names any number from 5 through 15. While the display appears completely off, the performer enters that number through an invisible tap map. The phone appears to wake to a personalized iPhone-style lock screen whose clock is exactly that many minutes in the future. After a configurable hold, the clock visibly rewinds one minute at a time until it reaches the real current time.

The trick does **not** require a force: every number from 5 to 15 can be entered in three value taps or fewer.

## Performance flow

1. Open the private setup screen.
2. Add the wallpaper used on the real phone and calibrate the clock against the live preview or an optional reference screenshot.
3. Tap **Arm performance**. The display becomes completely black.
4. Enter the freely named number with the invisible map below.
5. Tap the bottom third to confirm and wake, or let the third value tap auto-confirm.
6. The lock screen shows the chosen number of minutes in the future, holds, rewinds one minute at a time, and lands on the actual current minute.

## Secret input map

| Area | Value |
| --- | ---: |
| Upper left | 1 |
| Upper right | 2 |
| Middle left | 5 |
| Middle right | 10 |
| Bottom third | Confirm / wake |

Taps add together and areas may repeat. For example, 9 is `2 + 2 + 5`, and 14 is `2 + 2 + 10`; both auto-confirm on the third tap. Confirming before any value tap is a one-tap shortcut for 5.

## One-time setup

1. Enable GitHub Pages for the repository's `main` branch and open the Pages URL in Safari on the performing iPhone.
2. Use **Share → Add to Home Screen** and give it an innocent name such as “Clock.”
3. Open the installed app and upload the original lock-screen wallpaper without its clock.
4. If useful, upload a screenshot of the genuine lock screen as an alignment overlay.
5. Match clock style, tint, size, weight, vertical position, opacity, and wallpaper crop.
6. Choose the dramatic hold and rewind speed, then rehearse the invisible input.

The wallpaper, reference, appearance, and timing persist on that device. Uploaded images stay in the browser's IndexedDB and are not sent anywhere by this PWA.

## Performance controls

- Hold the upper-left corner for 1.25 seconds while armed to disarm.
- Triple-tap the upper-left corner after the reveal to reset for another performance.
- An invalid total gives a tiny vibration where supported and silently resets the input.
- The app requests wake lock, full screen, and portrait orientation where supported.

## Reality of the illusion

The app reproduces the visible lock-screen composition: personal wallpaper, large live-formatted time, date, lock glyph, optional bottom controls, and home indicator. It also handles midnight correctly and follows the real clock after the rewind lands. iOS may retain its native status bar in a standalone web app; the effect is designed to tolerate that system-controlled area.

## Files

- `index.html` — setup and performance screens
- `app.css` — responsive iPhone-style lock-screen rendering
- `app.js` — persistence, secret input, reveal, rewind, and recovery controls
- `core.js` — tested time and input logic
- `manifest.webmanifest` and `sw.js` — installable, offline-capable PWA shell
- `icon-*` and `icon.svg` — neutral Clock home-screen icon

There are no runtime dependencies or build step. All URLs are relative so the app works on GitHub Pages under the repository subpath.
