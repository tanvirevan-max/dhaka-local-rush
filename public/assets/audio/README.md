# Optional audio files

The game works with NO files here. All engine, horn, bell, siren, crash, wind and market-ambience sounds are
synthesised with the Web Audio API. Voice lines use the browser's Bengali (bn) speech voice when the device has
one, and are always shown as on-screen subtitles as well.

To add real recordings, drop files in `voice/` and `sfx/` and list them in `manifest.json`. Paths are relative to
this folder. Nothing else needs to change.

```json
{
  "voice": {
    "call_mirpur_1": "voice/call_mirpur_1.mp3",
    "helper_crash_1": "voice/helper_crash_1.mp3"
  },
  "sfx": {
    "horn": "sfx/bus_horn.mp3",
    "bell": "sfx/bicycle_bell.mp3",
    "crash": "sfx/crash.mp3"
  }
}
```

* **voice keys** are the `id` of a line in `src/config/dialogue.js` (for example `call_mirpur_1`, `stop_board_2`,
  `police_bust_1`). A line with a recording plays the file instead of text-to-speech. The subtitle still shows.
* **sfx keys** currently supported: `horn`, `bell`, `crash`. If a key is missing the synthesised sound is used.
  The engine, siren and ambience are always synthesised.
* Prefer short mono `.mp3` / `.ogg` clips. Voice is mixed with the "Voice" volume slider, sfx with "Effects".

No recordings are included in this project. Use only audio you have the rights to.
