# ঢাকা লোকাল রাশ — Dhaka Local Rush

A mobile-first 3D browser arcade game. You drive a chaotic Bangladeshi local bus through five connected,
Dhaka-inspired areas (Badda → Rampura → Mirpur → Mirpur 10 → Agargaon), with a bus helper hanging off the door
shouting at you in Bengali. Weave through rickshaws, CNGs, motorcycles, cars and trucks, pick up passengers at kerb-side
stops, and shake off the police.

* **Stack:** Three.js, plain JavaScript (ES modules), Vite, HTML/CSS. No backend, no paid APIs, no external assets.
* **All art and sound is generated in code.** Buses, vehicles, buildings, signs (Bengali text drawn to a canvas atlas),
  characters and every sound are procedural, so there is nothing to license.
* **Inspiration only:** atmosphere inspired by the idea of chaotic local-bus traffic games. No code, art or branding was copied.
  Shop names, ads and road signs are fictional. The areas are a stylised interpretation, not a map.

---

## 1. Run it locally

You need **Node.js 20.19+ or 22.12+** (required by Vite 8) and npm.

```bash
npm install
npm run dev        # http://localhost:5173  (also reachable from your phone on the same Wi-Fi, see the printed Network URL)
```

Production build and preview:

```bash
npm run build      # outputs ./dist
npm run preview    # serves ./dist on http://localhost:4173
```

Handy URL flags: `?q=low` or `?q=high` force graphics quality, `?touch=1` shows the on-screen buttons on a desktop,
`?debug=1` exposes the running game as `window.__game` in the console and logs the result of each run.

## 2. Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate | `W` / `↑` | GAS button |
| Brake / reverse | `S` / `↓` | BRAKE button |
| Steer | `A` `D` / `←` `→` | ◀ ▶ buttons |
| Boost | `Shift` | ⚡ button |
| Horn (nudges bikes, rickshaws and CNGs out of the way) | `Space` / `H` | 📯 button |
| Pause | `Esc` / `P` | ❚❚ button |
| Restart run | `R` | Pause menu → Restart |

Keyboard bindings live in `src/config/gameConfig.js` (`CONTROLS.keys`).

## 3. How the game plays

* **Drive on the left.** Your carriageway is the left half; oncoming traffic uses the right half. The median is crossable, but
  it has pillars and lamps, and driving on the wrong side raises police heat.
* **Score:** distance, **near misses**, **tight gaps** (two near misses on opposite sides in quick succession), a **combo
  multiplier** (up to ×5), passenger pickups, shoving light vehicles, escaping police, survival bonuses and completing the
  route. Hard crashes cost score and body integrity.
* **Passengers:** pull into the yellow bay at a kerb-side bus stop, slow below 7.5 m/s and hold for 1 s. You get bonus
  points and a small repair. Complete the full five-area route for a big bonus (extra if you boarded 5+ passengers).
* **Police:** heat rises when you crash into traffic or drive on the oncoming side. At 100 the police join the chase (up to
  3 units, more every 22 s). A unit within ~10 m fills the BUSTED meter. Stay ~95 m ahead for 6 s to ESCAPE. Boost helps.
* **Boost:** limited energy that regenerates, steering gets heavier while boosting.
* **Game over:** body integrity reaches 0 (wrecked) or you are busted. Your best score is saved in the browser (`localStorage`).
* **Traffic jams** appear every minute or so with one lane left open. The HUD warns you.

All balance numbers are in `src/config/gameConfig.js` (scoring, damage, boost, police, traffic, camera).

## 4. Put it on GitHub

```bash
git init
git add .
git commit -m "Dhaka Local Rush"
git branch -M main
# create an empty repository on github.com first, then:
git remote add origin https://github.com/<your-user>/dhaka-local-rush.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `dist`.

## 5. Deploy on Vercel

**From GitHub (recommended):** on vercel.com choose *Add New → Project*, import the repository, and accept the defaults.
`vercel.json` already sets the framework to Vite, build command `npm run build`, output directory `dist`. Click *Deploy*.

**From the command line:**

```bash
npm i -g vercel
vercel          # first run links the project, then gives you a preview URL
vercel --prod   # production deployment
```

`vite.config.js` uses `base: './'`, so the build also works from a sub-path or any static host (GitHub Pages, Netlify, itch.io HTML5).

## 6. Optional manual assets

The game is complete without any files. You may add:

| What | Where | Notes |
|---|---|---|
| Recorded Bengali voice lines | `public/assets/audio/voice/` + `manifest.json` | Keyed by the line `id` in `src/config/dialogue.js`. Without a file the browser's Bengali speech voice is used (if the device has one), and subtitles are always shown. |
| Real horn / bell / crash sounds | `public/assets/audio/sfx/` + `manifest.json` | Keys `horn`, `bell`, `crash`. Synthesised sounds are the fallback. |
| Custom 3D models | not loaded today | See `public/assets/models/README.md`. |
| Extra buses | `PLAYER_BUSES` in `src/config/gameConfig.js` | The menu picks new entries up automatically. |
| More Dhaka areas | `src/config/zones.js` (+ new signs in `src/config/signs.js`) | Each zone sets palette, building heights, features, traffic mix and the helper's call-out line. |
| More Bengali dialogue | `src/config/dialogue.js` | Pools, cooldowns and priorities are all configurable. |

See `public/assets/audio/README.md` for the exact manifest format.

## 7. Project layout

```
index.html                 canvas + HUD/menu roots + WebGL-unavailable message
vite.config.js, vercel.json, package.json
public/                    favicon + optional audio/model folders
src/main.js                WebGL check, Bengali font, boot
src/styles.css             HUD, menus, touch buttons (responsive, safe-area aware)
src/ui/HUD.js, Menus.js    DOM HUD (score, combo, speed, boost, body, police, route/stop, subtitles) and menu screens
src/config/                gameConfig (balance), zones, vehicles, signs, dialogue
src/game/Game.js           renderer, main loop, rules: scoring, damage, heat, boost, game states
src/game/Vehicle.js        arcade vehicle body (mass, grip, spin, tipping)
src/game/CollisionManager.js  oriented-box SAT collisions, impulses, friction, walls and median pillars
src/game/TrafficManager.js    lane following, headway, lane changes, jams, pooled vehicles
src/game/PoliceManager.js     heat, pursuit levels, bust/escape meters, units + lights
src/game/MissionManager.js    bus stops, boarding, route progress, zone announcements
src/game/PlayerBus.js, Helper.js   player bus + animated door helper (IK-locked hand on the door pole)
src/game/Environment.js + scenery/  streamed 84 m road chunks, procedural buildings/signs/props per zone
src/game/models/           procedural vehicle geometry
src/game/AudioManager.js   Web Audio synthesis, Bengali speech + subtitle voice system
src/game/CameraController.js, Effects.js, InputManager.js, ScoreManager.js, Storage.js
```

## 8. Test checklist

Work through this on a desktop browser and on at least one phone before you ship.

- [ ] `npm install && npm run build` finishes without errors.
- [ ] Start screen shows the three buses; picking one changes the bus in the background. **Play** opens the tutorial once, then the game.
- [ ] Keyboard: W/S accelerate/brake, A/D steer, Shift boosts (boost bar drains), Space honks, Esc pauses, R restarts.
- [ ] Touch (phone, portrait and landscape): GAS, BRAKE, ◀ ▶, horn and boost buttons respond, multiple at once; the page never scrolls or zooms.
- [ ] Traffic: oncoming cars on the right, bikes/rickshaws weave, a jam eventually appears with the "জ্যাম" warning.
- [ ] Collision: hitting a car shoves it and shakes the camera; a pillar or heavy bus hurts much more; integrity bar drops.
- [ ] Near miss gives pop-ups and a combo; the multiplier shows next to the score.
- [ ] Bus stop: slowing in the yellow bay for 1 s boards passengers and shows `+points`.
- [ ] Wrong-way driving for about 10 s starts a police chase (siren, flashing lights, ★ meter).
- [ ] Being caught shows BUSTED; outrunning for 6 s shows an escape bonus; 0 % integrity shows WRECKED.
- [ ] Game over screen shows stats; best score survives a page reload.
- [ ] Settings: volume sliders change loudness; subtitles and camera-shake toggles work; the values persist after reload.
- [ ] Audio starts after the first tap or click (browsers block it before that). Bengali speech works only if the device has a Bengali voice; otherwise subtitles appear.
- [ ] Rotate the phone mid-game and resize the desktop window: the view and HUD adapt.
- [ ] Switch tab or lock the phone: the game pauses.
- [ ] Open in a browser with WebGL disabled: a clear "WebGL unavailable" message is shown.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run build` fails with an engine/syntax error | Update Node to 20.19+ or 22.12+ (`node -v`). |
| Black screen or "WebGL unavailable" | Enable hardware acceleration in the browser settings, update the browser/GPU driver, or try another browser. |
| Low frame rate | Settings → Graphics → **Low**, or add `?q=low`. Auto quality also lowers the render resolution when the frame rate drops. Close other GPU-heavy tabs. |
| No sound | Click/tap once first (autoplay policy). Check the Master slider and the device's silent switch. iOS Safari mutes Web Audio when the ringer switch is on silent. |
| No Bengali voice | Your device has no Bengali text-to-speech voice. Subtitles still show. Install a Bengali voice in the OS, or add recordings (section 6). |
| Bengali text looks like boxes | The bundled Noto Sans Bengali font failed to load; check that the `dist/assets/*.woff2` files are being served. |
| Controls do nothing | Click the page once so it has keyboard focus; the game ignores keys while a menu is open. |
| Blank page on a static host from a sub-folder | The build uses relative paths (`base: './'`); make sure you upload the whole `dist` folder. |
| Best score not saved | The browser blocks `localStorage` (private mode). The game keeps working but forgets the score. |

## 10. What is implemented, and what is simplified

**Implemented**

* Five distinct, connected areas that loop, each with its own palette, fog/sky, building style, signage, props and traffic mix:
  flyover and footbridges (Rampura), stadium and school (Mirpur), metro viaduct and a roundabout (Mirpur 10), government
  buildings (Agargaon). Bengali shop signs, ads, road signs and bus stops. Left-side traffic.
* Player bus with three variants, animated wheels, brake lights, name boards and exhaust, plus a procedural **door helper**
  (attached to the bus, right hand locked to the door pole, left-arm gestures, talking mouth) who reacts to what happens.
* Traffic: buses, trucks, cars, CNGs, rickshaws, motorcycles and bicycles with lane following, following distance, lane
  changes, honking and traffic jams. Light vehicles can be knocked over and disappear.
* Mass-based collisions with knockback, spin, sparks, dust, camera shake, integrity damage and score penalties.
* Scoring: near miss, oncoming squeeze, tight gap, combo multiplier, pickups, ramming, police escape, survival, route bonus.
* Police pursuit with heat, three pursuit levels, bust and escape meters, flashing lights and siren.
* Boost with an energy meter, FOV change and flames. Smooth chase camera.
* Synthesised audio (engine with gears, horns, bicycle bell, tyre squeal, crashes, siren, wind, market ambience), separate
  volume groups, contextual Bengali dialogue with priorities and cooldowns, optional recorded files via a manifest.
* HUD, tutorial, pause, settings, game-over screen, best score in `localStorage`, WebGL-unavailable message,
  resize/orientation handling, audio unlock on first gesture, auto quality scaling.

**Simplified (honest limits)**

* The areas are stylised and fictional in layout; they are not a map of real Dhaka. Shop names are invented.
* Only the endless mode exists. The "mission" layer is the route progress and passenger stops, not separate game modes.
* Vehicle physics is a 2D arcade model (oriented boxes with impulses). There is no suspension or vertical motion;
  tipping is a visual roll on light vehicles.
* Pedestrians and passengers are scenery or short boarding animations; they do not run into the road or take damage.
* Police have no roadblocks or helicopters; they chase through traffic.
* All models are low-poly, flat-shaded and procedural. No bundled sound recordings and no gamepad support.
* No day/night or weather; the sky and fog change per area only.
* Bengali speech uses the browser's text-to-speech voice, so quality and availability depend on the device.

## 11. What was and was not verified

Verified in this project's build environment (headless Chromium with software WebGL, production build served by `vite preview`):

* `npm install` and `npm run build` succeed, and the game starts with no console errors or warnings.
* Scripted drives exercised: acceleration/steering, pickups (dozens of passengers in a 4-minute run), scoring and combos,
  wrong-way heat starting a pursuit, bust, escape (+1500), route completion bonus, all five areas and the loop back to the first,
  static-pillar and vehicle crashes, wreck game over, pause/resume/restart, settings and best score persistence, bus selection,
  quality switching and repeated restarts (no runaway memory), the no-WebGL message, and phone-sized portrait and
  landscape layouts with emulated touch buttons.

**Not verified** (needs you): real-GPU frame rates (software rendering was too slow to say anything about speed), real phones
and tablets, Safari and Firefox, how the synthesised audio actually sounds, Bengali text-to-speech on real devices,
and pushing to GitHub or deploying to Vercel. The steps above are standard but were not run from here.
