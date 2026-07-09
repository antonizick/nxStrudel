# REFERENCE.md — Strudel (on-demand appendix)

This is the deep reference for `CLAUDE.md` / `AGENTS.md`. **Read it only when you
need it** — doing dev work on the app, or looking up Strudel syntax the cheat-sheet
in `CLAUDE.md` doesn't cover. A local model running a jam does **not** need this file;
the lean prompt in `CLAUDE.md` is enough to make music.

---

## Project context (dev work)

- **Planning doc:** `/home/nick/dev/lucent/idea/_workingArea/strudel/strudel_workshop.md`
- **Assigned port:** `4321` — registered in `idea/PORTS.md` AND `idea/project-health.sh`.
  Port deconfliction is mandatory: never bind another port without updating **both**
  files. They must stay in sync.
- **Working dir:** this directory and below.
- **Stay in scope:** do not modify `/home/nick/dev/lucent/memory/` (other than the daily
  note) or other `idea/<project>/` directories unless explicitly asked.
- **Dev server:** `corepack pnpm dev` (root) or
  `corepack pnpm --filter @strudel/website exec astro dev --port 4321`.
  Nick often has a live instance running on 4321 — never kill it. For throwaway
  verification, run on a spare port (e.g. 4322) and kill it by **exact PID**, never
  `pkill -f astro` (that matches Nick's session too).
- **REPL visualizer work:** `website/src/repl/components/panel/VisualizerTab.jsx`
  (AudioMotion Analyzer + logo overlay), wired into `Panel.jsx`, settings in
  `website/src/settings.mjs` (`visualizer*` keys).
- **Monorepo:** pnpm workspaces (`pnpm-workspace.yaml`) + lerna; REPL/website app is
  `website/`, core packages under `packages/`.

## Pattern Bridge — how it works (internals)

I write/edit `bridge/pattern.strudel`; Nick's live browser tab picks it up and plays it.

- Middleware in `website/astro.config.mjs` (`strudelBridgePlugin`) serves
  `GET/POST /bridge/pattern` ↔ `bridge/pattern.strudel`.
- `website/src/repl/bridge.mjs` polls every 1s: file changes → pushed into his editor
  (`setCode`), auto-evaluated if `bridgeAutoEval` is on (default) **and** he already has
  playback running (browser audio needs his own click to unlock — I can't start the
  very first playback in a session).
- When Nick evaluates in his browser, his buffer is written back to the same file —
  that's how I see his edits.
- An idle guard skips applying incoming changes for 1.5s after his last keystroke, so a
  mid-typing edit isn't clobbered by a bridge write.
- **Check the bridge is live:** `curl -s http://localhost:4321/bridge/pattern` →
  `{"code":...,"mtimeMs":...}` means live. Astro config (middleware) changes need a full
  server restart; client-side files (`bridge.mjs`, `settings.mjs`, `SettingsTab.jsx`)
  only need Nick to refresh his tab.
- **Heads-up (known friction):** because the browser writes back, a Read→Edit on
  `bridge/pattern.strudel` can race the bridge write and fail with *"File has been
  modified since read."* Re-Read and retry, or use Write for a full replace.

## Workflow conventions (from the first sessions)

- Toggle variables near the top per layer (`const useDrums = 1`, etc.), gating the final
  `stack()` with `useX ? layer : silence` (`silence` is a real `@strudel/core` export).
- Song structure (verse/chorus, not one loop): `arrange([cycles, pattern], ...)` — real
  API at `packages/core/pattern.mjs`.
- Vocal samples: `samples('github:tidalcycles/dirt-samples')`. The `yeah` bank (31
  samples) is the classic techno/house vocal-chant set — use it for "female vocal"
  requests, not `speech`/`speechless` (breathy syllables that turn to noise when
  processed hard).
- **Avoid `.chop()` on short one-shots** — slices with no crossfade → hard clicks.
  Prefer euclidean gating (`"yeah:3(3,8)"`) and add `.attack(.01).release(.05)`.
- Verify unfamiliar syntax against `website/src/repl/tunes.mjs` or
  `packages/core/pattern.mjs` before sending.
- Before trusting an external sample bank name, fetch the manifest
  (`https://raw.githubusercontent.com/<user>/<repo>/<branch>/strudel.json`).

---

## Full Strudel reference

### Mini-notation (inside the quotes)

| Write | Meaning |
|---|---|
| `bd sd hh sd` | 4 events in one cycle |
| `~` | rest |
| `[bd bd] sd` | brackets subdivide one step |
| `<a b c>` | alternate: a this cycle, b next, then c |
| `bd*4` | repeat 4x (faster) |
| `bd/2` | play every 2nd cycle (slower) |
| `bd!3` | same as writing it 3 times |
| `bd@3` | one event lasting 3 units |
| `bd*4, hh*8` | comma = simultaneous layers |
| `bd(3,8)` | euclidean rhythm: 3 hits over 8 steps |
| `hh*8?` | each event 50% chance to drop (`?0.2` = 20%) |
| `[bd\|cp\|sd]` | random pick each cycle |
| `0 .. 7` | the numbers 0 1 2 3 4 5 6 7 |
| `hh:3` | sample number 3 of the hh bank |

### Sounds

**Drums** (always available): `bd` kick · `sd` snare · `hh` closed hat · `oh` open hat ·
`cp` clap · `rim` rimshot · `lt mt ht` toms · `rd` ride · `cr` crash. Flavor with
`.bank('RolandTR909')` (house/techno), `'RolandTR808'` (hip-hop/trap), `'RolandTR707'`,
`'LinnDrum'` (80s pop), `'AkaiLinn'`, `'RhythmAce'`, `'ViscoSpaceDrum'`.

**Synth waveforms** (with `note(...)`): `sawtooth`, `square`, `triangle`, `sine`,
`supersaw` (big trance lead).

**Melodic/misc samples**: `piano`, `casio`, `jazz` (lo-fi kit), `metal`, `east`, `space`,
`wind`, `crow`, `insect`, `numbers`.

**GM instruments** (with `note(...)`, real-instrument sounds):
gm_piano, gm_epiano1, gm_epiano2, gm_harpsichord, gm_clavinet, gm_celesta,
gm_music_box, gm_vibraphone, gm_marimba, gm_xylophone, gm_glockenspiel,
gm_tubular_bells, gm_kalimba, gm_steel_drums,
gm_acoustic_bass, gm_electric_bass_finger, gm_fretless_bass, gm_slap_bass_1,
gm_synth_bass_1, gm_synth_bass_2,
gm_acoustic_guitar_nylon, gm_acoustic_guitar_steel, gm_electric_guitar_clean,
gm_electric_guitar_jazz, gm_electric_guitar_muted, gm_distortion_guitar,
gm_overdriven_guitar, gm_sitar, gm_banjo, gm_koto, gm_dulcimer,
gm_violin, gm_cello, gm_orchestral_harp, gm_string_ensemble_1, gm_synth_strings_1,
gm_tremolo_strings, gm_pizzicato_strings, gm_timpani, gm_taiko_drum,
gm_trumpet, gm_muted_trumpet, gm_trombone, gm_french_horn, gm_brass_section,
gm_alto_sax, gm_tenor_sax, gm_clarinet, gm_oboe, gm_bassoon, gm_flute, gm_pan_flute,
gm_recorder, gm_ocarina, gm_whistle, gm_harmonica, gm_accordion,
gm_church_organ, gm_drawbar_organ, gm_rock_organ,
gm_choir_aahs, gm_voice_oohs, gm_synth_choir,
gm_lead_1_square, gm_lead_2_sawtooth, gm_lead_6_voice, gm_lead_8_bass_lead,
gm_pad_new_age, gm_pad_warm, gm_pad_poly, gm_pad_choir, gm_pad_halo, gm_pad_sweep,
gm_pad_metallic, gm_pad_bowed,
gm_fx_crystal, gm_fx_atmosphere, gm_fx_rain, gm_fx_sci_fi, gm_fx_echoes, gm_fx_soundtrack.

**Dirt-samples** (require `samples('github:tidalcycles/dirt-samples')`): `yeah` is the
classic house/techno vocal-chant bank. Don't guess other bank names.

### Notes, scales, chords

- `note("c3 eb3 g3 bb3")` — letter + octave. Sharps `c#3`, flats `eb3`. Range `c1`–`c6`.
  MIDI numbers work too: `note("48 55 60")`.
- `n("0 2 4 <6 7>").scale("C4:minor")` — scale degrees; always in key. Scales: `major`,
  `minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `major:pentatonic`,
  `minor:pentatonic`. Root may include octave: `"G2:minor"`.
- Chords: commas inside brackets play together: `note("<[c3,eb3,g3] [f3,ab3,c4]>")`.
- `.transpose(12)` — shift by semitones (negative = down).

### Shaping and effects (chain after the sound)

- Volume/space: `.gain(0.8)` · `.pan(0)`/`.pan(1)` · `.room(0.5)` · `.roomsize(4)`
- Filter: `.lpf(800)` · `.lpq(10)` resonance · `.hpf(200)` · `.vowel("<a e i o>")`
- Envelope: `.attack(0.01)` · `.decay(0.15)` · `.sustain(0.3)` · `.release(0.1)`
  (seconds; sustain is a 0–1 level). Punchy bass = low decay, `sustain(0)`.
- Delay: `.delay(0.4)` · `.delaytime(0.125)` · `.delayfeedback(0.6)`
- Grit: `.shape(0.4)` · `.distort(0.6)` · `.crush(6)` (4 harsh, 12 subtle) · `.coarse(4)`
- Sample control: `.speed(2)` · `.speed(-1)` reverse · `.begin(0.25)` · `.clip(0.5)`
- Mix: `.postgain(0.8)` · `slider(0.8, 0, 1)` in place of any number = draggable knob

### Movement (LFOs / signals)

`sine`, `cosine`, `saw`, `isaw`, `tri`, `square`, `rand`, `perlin` are smooth 0..1
signals. Shape with `.range(low, high)` and `.slow(cycles)`:

- Filter sweep: `.lpf(sine.range(200, 2400).slow(8))`
- Auto-pan: `.pan(sine.slow(4))`
- Humanized hats: `.gain(rand.range(0.4, 0.8))`
- Random melody: `n(perlin.range(0, 7).segment(8)).scale("C4:minor")`

### Transforming patterns

- `.fast(2)` / `.slow(2)` · `.rev()`
- `.every(4, x => x.rev())` — every 4th cycle
- `.sometimes(x => x.speed(2))` (`.often` 75%, `.rarely` 25%, `.sometimesBy(0.3, ...)`)
- `.off(1/8, x => x.add(note(12)).gain(0.5))` — layer a modified copy later
- `.jux(x => x.rev())` — original left, modified right (instant stereo)
- `.add(note("<0 0 5 7>"))` — chord-progression movement
- `.ply(2)` · `.echo(3, 1/8, 0.5)` · `.degradeBy(0.3)` · `.iter(4)` · `.palindrome()`
- `.struct("x ~ x x ~ x ~ ~")` · `.euclid(3, 8)` · `.mask("1 1 0 1")`
- `.superimpose(x => x.add(note(12)))`

### Song structure

- `stack(a, b, c)` — play together (the mix)
- `cat(a, b)` — a one cycle, then b, repeat
- `arrange([8, verse], [8, chorus])` — verse 8 cycles, chorus 8, loops forever
- `silence` — plays nothing (for toggles: `useX ? x : silence`)

### Extra templates

**Lo-fi chill (76 BPM):**

```javascript
setcpm(76/4)
const useDrums = 1, useKeys = 1, useBass = 1

const drums = s("bd ~ [~ bd] ~, ~ sd ~ sd, hh*8").bank('RolandTR808')
  .gain(0.8).degradeBy(0.05)
const keys  = n("<0 2 4 3>(3,8)").scale("D4:minor:pentatonic").s('gm_epiano1')
  .room(0.4).delay(0.3).delaytime(0.16).delayfeedback(0.4).gain(0.7)
const bass  = note("<d2 d2 f2 a1>").slow(2).s('gm_acoustic_bass').gain(0.8)

stack(useDrums ? drums : silence, useKeys ? keys : silence, useBass ? bass : silence)
```

**Full song via arrange (verse/chorus):**

```javascript
setcpm(120/4)
const drumsA = s("bd*4, ~ cp ~ cp, hh*8").bank('RolandTR909')
const drumsB = s("bd*4, ~ cp ~ cp, [~ hh]*4, oh(3,8)").bank('RolandTR909')
const bassA  = note("<c2 c2 eb2 g1>*4").s('sawtooth').lpf(500).decay(0.15).sustain(0)
const bassB  = bassA.lpf(sine.range(400, 2000).slow(4)).add(note("<0 0 3 5>"))
const lead   = n("0 <4 7> 2 <5 3>").scale("C4:minor").s('gm_lead_2_sawtooth')
  .off(1/8, x => x.add(note(12)).gain(0.4)).delay(0.3).gain(0.6)

arrange([8, stack(drumsA, bassA)], [8, stack(drumsB, bassB, lead)])
```

---

## Code philosophy (dev work)

Before writing code, stop at the first rung that holds:
1. Does this need to exist? (YAGNI) → skip it, say so
2. Stdlib does it? → use it
3. Native platform feature? → use it
4. Already-installed dependency? → use it
5. One line? → one line
6. Only then: the minimum that works

Rules: no unrequested abstractions; deletion over addition; boring over clever; shortest
working diff. Mark simplifications: `# lucent: <ceiling>, <upgrade path>`. Non-trivial
logic leaves ONE runnable check. Never simplify away: trust-boundary validation,
data-loss handling, security, accessibility.

## Output style

Drop filler (just/really/basically), pleasantries, hedging. Fragments OK. Full prose for:
security warnings, irreversible-action confirmations, ambiguous multi-step sequences, user
confusion. Commits: conventional, ≤50 char subject, imperative, why over what.

## What's NOT loaded in project mode

Lucent identity (`lucentIdent.md`, `userIdent.md`), `LTMemory.md`, active reminders,
priority email, daily-note tail. Need them? Switch back: `cd /home/nick/dev/lucent && claude`.
