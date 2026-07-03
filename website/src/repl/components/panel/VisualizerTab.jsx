import { useEffect, useRef, useState } from 'react';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { getAudioContext, getSuperdoughAudioController } from '@strudel/webaudio';
import cx from '@src/cx.mjs';
import { useSettings, setVisualizerSetting } from '../../../settings.mjs';

const inputClass =
  'bg-background text-xs h-8 max-h-8 border border-box rounded-0 text-foreground border-muted placeholder-muted focus:outline-none focus:ring-0 focus:border-foreground';

function FormItem({ label, children }) {
  return (
    <div className="grid gap-1 text-xs">
      <label className="text-xs opacity-75">{label}</label>
      {children}
    </div>
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select className={cx('p-1', inputClass)} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, label]) => (
        <option key={k} className="bg-background" value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Checkbox({ label, value, onChange }) {
  return (
    <label className="text-xs flex items-center space-x-1">
      <input
        className="bg-background border border-muted focus:outline-none focus:ring-0 focus:border-foreground"
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Slider({ value, onChange, min = 0, max = 1, step = 0.05 }) {
  return (
    <input
      className="w-full accent-foreground"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function ButtonGroup({ value, onChange, items }) {
  return (
    <div className="flex space-x-0 text-xs">
      {Object.entries(items).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cx(
            'px-2 border-b-2 h-7 whitespace-nowrap hover:opacity-50',
            value === key ? 'border-foreground' : 'border-transparent',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const modeOptions = {
  0: 'Discrete Frequencies',
  10: 'Graph',
  8: 'Octave Bands (1/1)',
  7: 'Octave Bands (1/2)',
  6: 'Octave Bands (1/3)',
  5: 'Octave Bands (1/4)',
  3: 'Octave Bands (1/8)',
  1: 'Octave Bands (1/24)',
};

const gradientOptions = {
  classic: 'Classic',
  prism: 'Prism',
  rainbow: 'Rainbow',
  orangered: 'Orange Red',
  steelblue: 'Steel Blue',
};

const mirrorOptions = { 0: 'None', '-1': 'Left', 1: 'Right' };

const sensitivityPresets = {
  low: { minDecibels: -70, maxDecibels: -20 },
  medium: { minDecibels: -85, maxDecibels: -25 },
  high: { minDecibels: -100, maxDecibels: -30 },
};

const reflexPresets = {
  off: { reflexRatio: 0 },
  mirror: { reflexRatio: 0.25, reflexAlpha: 0.15, reflexBright: 1 },
  full: { reflexRatio: 0.5, reflexAlpha: 0.25, reflexBright: 1 },
};

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const MAX_DANCE_IMAGES = 40;
const DANCE_SILENCE_ENERGY = 0.02; // below this, treat as "music stopped"
const DANCE_SILENCE_HOLD_MS = 400; // how long silence must persist before reverting to logo
const DANCE_MIN_INTERVAL_MS = 90; // fastest swap pace, at max energy or fastest note value
const DANCE_MAX_INTERVAL_MS = 480; // slowest swap pace, in auto mode at low (but audible) energy

// note value ladder for tempo-synced pacing, expressed as a fraction of one pattern cycle
// (quarter note = cycle / 4, assuming the conventional 4-beats-per-cycle reading)
const NOTE_LADDER = ['1', '2', '4', '8', '16', '32'];
const NOTE_LABELS = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: 'sixteenth', 32: 'thirty-second' };
const NOTE_LADDER_ENTRY = '4'; // where +/- lands you when leaving "auto"

// Dance-mode images must survive both switching away from the visualizer tab (Panel.jsx
// unmounts inactive tabs) and full page/server reloads. Held in a module-level store (so
// tab remounts don't drop it) backed by IndexedDB (so reloads don't either) — IndexedDB
// stores the actual Blobs natively (no base64 bloat like localStorage would need) and its
// quota is far larger, and it's browser/origin-scoped storage, so it's untouched by the
// Astro dev server restarting.
const danceImageStore = { urls: [] };

const DANCE_DB_NAME = 'strudel-visualizer';
const DANCE_DB_STORE = 'danceImages';
const DANCE_DB_KEY = 'current';

function openDanceDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DANCE_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DANCE_DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadDanceFilesFromDB() {
  const db = await openDanceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DANCE_DB_STORE, 'readonly');
    const req = tx.objectStore(DANCE_DB_STORE).get(DANCE_DB_KEY);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveDanceFilesToDB(files) {
  const db = await openDanceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DANCE_DB_STORE, 'readwrite');
    tx.objectStore(DANCE_DB_STORE).put(files, DANCE_DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearDanceFilesInDB() {
  const db = await openDanceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DANCE_DB_STORE, 'readwrite');
    tx.objectStore(DANCE_DB_STORE).delete(DANCE_DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// kicked off once per page load, memoized, so every tab (re)mount just awaits the same
// in-flight/finished read instead of hitting IndexedDB again
let danceImagesReady = null;
function initDanceImagesFromDB() {
  if (danceImagesReady) return danceImagesReady;
  danceImagesReady = (async () => {
    if (typeof indexedDB === 'undefined') return danceImageStore.urls;
    try {
      const files = await loadDanceFilesFromDB();
      if (files.length && !danceImageStore.urls.length) {
        danceImageStore.urls = files.map((f) => URL.createObjectURL(f));
      }
    } catch {
      // best-effort: IndexedDB can be unavailable (e.g. private browsing) — dance mode
      // still works in-memory for the session, it just won't survive a reload
    }
    return danceImageStore.urls;
  })();
  return danceImagesReady;
}
if (typeof window !== 'undefined') {
  initDanceImagesFromDB();
}

const logoPositionOptions = {
  center: 'Center',
  'top-left': 'Top Left',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
};

function logoPlacementStyle(position, sizePct) {
  const width = `${sizePct}%`;
  switch (position) {
    case 'top-left':
      return { top: '4%', left: '4%', width };
    case 'top-right':
      return { top: '4%', right: '4%', width };
    case 'bottom-left':
      return { bottom: '4%', left: '4%', width };
    case 'bottom-right':
      return { bottom: '4%', right: '4%', width };
    default:
      // uses the standalone CSS `translate` property (not `transform`) so the dance
      // driver can freely set `transform` (flip/scale) without clobbering centering
      return { top: '50%', left: '50%', width, translate: '-50% -50%' };
  }
}

export function VisualizerTab({ editorRef } = {}) {
  const containerRef = useRef(null);
  const analyzerRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const logoImgRef = useRef(null);
  const staticLogoSrcRef = useRef('');
  const danceStateRef = useRef({ lastSwap: 0, lastActive: 0, dancing: false, currentIndex: -1 });
  const danceSpeedModeRef = useRef('auto');
  const [error, setError] = useState(null);
  // lazy init: pick up images already loaded in a previous mount of this tab
  const [danceImageCount, setDanceImageCount] = useState(() => danceImageStore.urls.length);

  const {
    visualizerControlsOpen,
    visualizerMode,
    visualizerGradient,
    visualizerShowPeaks,
    visualizerRadial,
    visualizerAlphaBars,
    visualizerLumiBars,
    visualizerLedBars,
    visualizerMirror,
    visualizerReflex,
    visualizerBarSpace,
    visualizerSensitivity,
    visualizerBgAlpha,
    visualizerLogoImage,
    visualizerLogoOpacity,
    visualizerLogoLayer,
    visualizerLogoPosition,
    visualizerLogoSize,
    visualizerDanceSpeedMode,
  } = useSettings();

  // create the analyzer once, tapping strudel's own master output node
  useEffect(() => {
    if (!containerRef.current || analyzerRef.current) return;
    try {
      const audioCtx = getAudioContext();
      const masterGain = getSuperdoughAudioController().output.destinationGain;
      const analyzer = new AudioMotionAnalyzer(containerRef.current, {
        audioCtx,
        source: masterGain,
        connectSpeakers: false, // masterGain already connects to destination itself
        showScaleX: false,
        showScaleY: false,
      });
      analyzer.canvas.style.position = 'absolute';
      analyzer.canvas.style.inset = '0';
      analyzerRef.current = analyzer;

      // logo "dance" driver: piggybacks on the analyzer's own draw loop (no extra rAF),
      // mutates the logo <img> directly via refs (no React re-render), so it can't
      // add jank to the bars/canvas animation running alongside it.
      analyzer.onCanvasDraw = (instance) => {
        const img = logoImgRef.current;
        const urls = danceImageStore.urls;
        if (!img) return;
        const st = danceStateRef.current;
        const now = performance.now();
        const energy = instance.getEnergy();
        if (energy > DANCE_SILENCE_ENERGY) st.lastActive = now;
        const playing = urls.length > 0 && now - st.lastActive < DANCE_SILENCE_HOLD_MS;

        if (playing !== st.dancing) {
          st.dancing = playing;
          if (!playing) {
            st.currentIndex = -1;
            img.style.transform = '';
            if (staticLogoSrcRef.current) {
              img.src = staticLogoSrcRef.current;
              img.style.visibility = 'visible';
            } else {
              img.style.visibility = 'hidden';
            }
          }
        }
        if (!playing) return;

        const speedMode = danceSpeedModeRef.current;
        let interval;
        // cps = cycles per second, live from Strudel's own scheduler; a "quarter note"
        // is cycle / 4 (conventional 4-beats-per-cycle reading), etc.
        const cps = editorRef?.current?.repl?.scheduler?.cps;
        if (speedMode !== 'auto' && cps > 0) {
          interval = 1000 / cps / Number(speedMode);
        } else {
          interval = DANCE_MAX_INTERVAL_MS - energy * (DANCE_MAX_INTERVAL_MS - DANCE_MIN_INTERVAL_MS);
        }
        if (now - st.lastSwap < Math.max(DANCE_MIN_INTERVAL_MS, interval)) return;
        st.lastSwap = now;

        let idx = Math.floor(Math.random() * urls.length);
        if (urls.length > 1 && idx === st.currentIndex) idx = (idx + 1) % urls.length;
        st.currentIndex = idx;

        const bass = instance.getEnergy('bass');
        const flipX = Math.random() < 0.5 ? -1 : 1;
        const scale = 1 + Math.min(bass, 1) * 0.15;
        img.src = urls[idx];
        img.style.visibility = 'visible';
        img.style.transform = `scale(${flipX * scale}, ${scale})`;
      };
    } catch (err) {
      setError(err.message);
    }
    return () => {
      analyzerRef.current?.destroy();
      analyzerRef.current = null;
    };
  }, []);

  // keep the "revert to this when music stops" src in sync, without touching the DOM
  // mid-dance (the draw-loop driver above owns img.src while `dancing` is true)
  useEffect(() => {
    staticLogoSrcRef.current = visualizerLogoImage;
    if (!danceStateRef.current.dancing && logoImgRef.current) {
      logoImgRef.current.style.visibility = visualizerLogoImage ? 'visible' : 'hidden';
    }
  }, [visualizerLogoImage]);

  useEffect(() => {
    danceSpeedModeRef.current = visualizerDanceSpeedMode;
  }, [visualizerDanceSpeedMode]);

  // picks up images restored from IndexedDB — a no-op if that read already finished
  // before this mount (the lazy useState initializer already had the right count)
  useEffect(() => {
    initDanceImagesFromDB().then((urls) => setDanceImageCount(urls.length));
  }, []);

  // push setting changes to the running analyzer instance
  useEffect(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;
    analyzer.setOptions({
      mode: Number(visualizerMode),
      gradient: visualizerGradient,
      showPeaks: visualizerShowPeaks,
      radial: visualizerRadial,
      alphaBars: visualizerAlphaBars,
      lumiBars: visualizerLumiBars,
      ledBars: visualizerLedBars,
      mirror: Number(visualizerMirror),
      barSpace: visualizerBarSpace,
      bgAlpha: visualizerBgAlpha,
      ...sensitivityPresets[visualizerSensitivity],
      ...reflexPresets[visualizerReflex],
    });
  }, [
    visualizerMode,
    visualizerGradient,
    visualizerShowPeaks,
    visualizerRadial,
    visualizerAlphaBars,
    visualizerLumiBars,
    visualizerLedBars,
    visualizerMirror,
    visualizerBarSpace,
    visualizerSensitivity,
    visualizerBgAlpha,
    visualizerReflex,
  ]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError('logo image too large (max 3MB)');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setVisualizerSetting('visualizerLogoImage', reader.result);
    reader.readAsDataURL(file);
  };

  const handleDanceFolderSelect = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = ''; // allow re-selecting the same folder later
    if (!files.length) return;
    if (files.some((f) => f.size > MAX_LOGO_BYTES)) {
      setError('one or more images in that folder exceed 3MB and were skipped');
    } else {
      setError(null);
    }
    const usable = files.filter((f) => f.size <= MAX_LOGO_BYTES).slice(0, MAX_DANCE_IMAGES);
    danceImageStore.urls.forEach((url) => URL.revokeObjectURL(url));
    danceImageStore.urls = usable.map((f) => URL.createObjectURL(f));
    danceStateRef.current.currentIndex = -1;
    setDanceImageCount(danceImageStore.urls.length);
    // persist in the background — dance mode already works from the object URLs above
    // even if this fails (e.g. private browsing), it just won't survive a reload
    saveDanceFilesToDB(usable).catch(() => setError('images loaded, but could not be saved for next time'));
  };

  const clearDanceFolder = () => {
    danceImageStore.urls.forEach((url) => URL.revokeObjectURL(url));
    danceImageStore.urls = [];
    clearDanceFilesInDB().catch(() => {});
    danceStateRef.current = { lastSwap: 0, lastActive: 0, dancing: false, currentIndex: -1 };
    setDanceImageCount(0);
    if (logoImgRef.current) {
      logoImgRef.current.style.transform = '';
      if (staticLogoSrcRef.current) {
        logoImgRef.current.src = staticLogoSrcRef.current;
        logoImgRef.current.style.visibility = 'visible';
      } else {
        logoImgRef.current.style.visibility = 'hidden';
      }
    }
  };

  const stepDanceSpeed = (dir) => {
    if (visualizerDanceSpeedMode === 'auto') {
      setVisualizerSetting('visualizerDanceSpeedMode', NOTE_LADDER_ENTRY);
      return;
    }
    const idx = NOTE_LADDER.indexOf(visualizerDanceSpeedMode);
    const nextIdx = Math.min(NOTE_LADDER.length - 1, Math.max(0, idx + dir));
    setVisualizerSetting('visualizerDanceSpeedMode', NOTE_LADDER[nextIdx]);
  };
  const danceSpeedLabel =
    visualizerDanceSpeedMode === 'auto' ? 'auto (follows energy)' : `${NOTE_LABELS[visualizerDanceSpeedMode]} note`;

  return (
    <div className="w-full h-full flex flex-col text-foreground">
      <div ref={containerRef} className="relative w-full grow bg-black overflow-hidden min-h-[200px]">
        {(visualizerLogoImage || danceImageCount > 0) && (
          <img
            ref={logoImgRef}
            src={visualizerLogoImage || undefined}
            alt="logo overlay"
            className="absolute pointer-events-none block"
            style={{
              ...logoPlacementStyle(visualizerLogoPosition, visualizerLogoSize),
              opacity: visualizerLogoOpacity,
              zIndex: visualizerLogoLayer === 'front' ? 2 : 0,
              visibility: visualizerLogoImage ? 'visible' : 'hidden',
            }}
          />
        )}
      </div>
      <div className="shrink-0 border-t border-muted">
        <button
          className="w-full text-left px-2 py-1 text-xs hover:opacity-50"
          onClick={() => setVisualizerSetting('visualizerControlsOpen', !visualizerControlsOpen)}
        >
          {visualizerControlsOpen ? '▾' : '▸'} visualizer settings
        </button>
        {visualizerControlsOpen && (
          <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-auto max-h-[220px]">
            {error && <div className="col-span-full text-xs text-red-500">{error}</div>}
            <FormItem label="Analyzer Mode">
              <SelectInput
                value={visualizerMode}
                options={modeOptions}
                onChange={(v) => setVisualizerSetting('visualizerMode', v)}
              />
            </FormItem>
            <FormItem label="Gradient">
              <SelectInput
                value={visualizerGradient}
                options={gradientOptions}
                onChange={(v) => setVisualizerSetting('visualizerGradient', v)}
              />
            </FormItem>
            <FormItem label="Mirror">
              <SelectInput
                value={visualizerMirror}
                options={mirrorOptions}
                onChange={(v) => setVisualizerSetting('visualizerMirror', v)}
              />
            </FormItem>
            <FormItem label="Sensitivity">
              <ButtonGroup
                value={visualizerSensitivity}
                items={{ low: 'low', medium: 'medium', high: 'high' }}
                onChange={(v) => setVisualizerSetting('visualizerSensitivity', v)}
              />
            </FormItem>
            <FormItem label="Reflex">
              <ButtonGroup
                value={visualizerReflex}
                items={{ off: 'off', mirror: 'mirror', full: 'full' }}
                onChange={(v) => setVisualizerSetting('visualizerReflex', v)}
              />
            </FormItem>
            <FormItem label="Bar Spacing">
              <Slider
                value={visualizerBarSpace}
                min={0}
                max={0.5}
                onChange={(v) => setVisualizerSetting('visualizerBarSpace', v)}
              />
            </FormItem>
            <FormItem label="Background Opacity">
              <Slider value={visualizerBgAlpha} onChange={(v) => setVisualizerSetting('visualizerBgAlpha', v)} />
            </FormItem>
            <FormItem label="Effects">
              <div className="flex flex-wrap gap-x-2">
                <Checkbox
                  label="peaks"
                  value={visualizerShowPeaks}
                  onChange={(v) => setVisualizerSetting('visualizerShowPeaks', v)}
                />
                <Checkbox
                  label="radial"
                  value={visualizerRadial}
                  onChange={(v) => setVisualizerSetting('visualizerRadial', v)}
                />
                <Checkbox
                  label="LEDs"
                  value={visualizerLedBars}
                  onChange={(v) => setVisualizerSetting('visualizerLedBars', v)}
                />
                <Checkbox
                  label="lumi"
                  value={visualizerLumiBars}
                  onChange={(v) => setVisualizerSetting('visualizerLumiBars', v)}
                />
                <Checkbox
                  label="alpha"
                  value={visualizerAlphaBars}
                  onChange={(v) => setVisualizerSetting('visualizerAlphaBars', v)}
                />
              </div>
            </FormItem>

            <FormItem label="Logo Image">
              <div className="flex space-x-2">
                <button className="px-2 border border-muted hover:opacity-50" onClick={() => fileInputRef.current?.click()}>
                  upload
                </button>
                {visualizerLogoImage && (
                  <button
                    className="px-2 border border-muted hover:opacity-50"
                    onClick={() => setVisualizerSetting('visualizerLogoImage', '')}
                  >
                    remove
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </FormItem>
            <FormItem label="Logo Dance Folder">
              <div className="flex flex-col gap-1 items-start">
                <button
                  className="px-2 border border-muted hover:opacity-50 whitespace-nowrap"
                  onClick={() => folderInputRef.current?.click()}
                >
                  select folder
                </button>
                {danceImageCount > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="opacity-75 whitespace-nowrap">{danceImageCount} imgs</span>
                    <button
                      className="px-2 border border-muted hover:opacity-50 whitespace-nowrap"
                      onClick={clearDanceFolder}
                    >
                      clear
                    </button>
                  </div>
                )}
                <input
                  ref={folderInputRef}
                  type="file"
                  accept="image/*"
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleDanceFolderSelect}
                />
              </div>
            </FormItem>
            <FormItem label="Dance Speed">
              <div className="flex flex-col gap-1">
                <div className="flex items-center space-x-1">
                  <button
                    className="w-6 h-7 border border-muted hover:opacity-50"
                    onClick={() => stepDanceSpeed(-1)}
                    title="slower note value"
                  >
                    −
                  </button>
                  <button
                    className={cx(
                      'px-2 h-7 border border-muted hover:opacity-50 whitespace-nowrap',
                      visualizerDanceSpeedMode === 'auto' && 'border-foreground',
                    )}
                    onClick={() => setVisualizerSetting('visualizerDanceSpeedMode', 'auto')}
                  >
                    default
                  </button>
                  <button
                    className="w-6 h-7 border border-muted hover:opacity-50"
                    onClick={() => stepDanceSpeed(1)}
                    title="faster note value"
                  >
                    +
                  </button>
                </div>
                <span className="opacity-75 whitespace-nowrap">{danceSpeedLabel}</span>
              </div>
            </FormItem>
            <FormItem label="Logo Layer">
              <ButtonGroup
                value={visualizerLogoLayer}
                items={{ back: 'behind', front: 'in front' }}
                onChange={(v) => setVisualizerSetting('visualizerLogoLayer', v)}
              />
            </FormItem>
            <FormItem label="Logo Position">
              <SelectInput
                value={visualizerLogoPosition}
                options={logoPositionOptions}
                onChange={(v) => setVisualizerSetting('visualizerLogoPosition', v)}
              />
            </FormItem>
            <FormItem label="Logo Opacity">
              <Slider
                value={visualizerLogoOpacity}
                onChange={(v) => setVisualizerSetting('visualizerLogoOpacity', v)}
              />
            </FormItem>
            <FormItem label="Logo Size">
              <Slider
                value={visualizerLogoSize}
                min={10}
                max={100}
                step={5}
                onChange={(v) => setVisualizerSetting('visualizerLogoSize', v)}
              />
            </FormItem>
          </div>
        )}
      </div>
    </div>
  );
}
