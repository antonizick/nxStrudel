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

export function VisualizerTab() {
  const containerRef = useRef(null);
  const analyzerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);

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
    visualizerLogoPosition,
    visualizerLogoSize,
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
    } catch (err) {
      setError(err.message);
    }
    return () => {
      analyzerRef.current?.destroy();
      analyzerRef.current = null;
    };
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

  return (
    <div className="w-full h-full flex flex-col text-foreground">
      <div ref={containerRef} className="relative w-full grow bg-black overflow-hidden min-h-[200px]">
        {visualizerLogoImage && (
          <img
            src={visualizerLogoImage}
            alt="logo overlay"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: `${visualizerLogoSize}%`,
              opacity: visualizerLogoOpacity,
              zIndex: visualizerLogoPosition === 'front' ? 2 : 0,
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
            <FormItem label="Logo Layer">
              <ButtonGroup
                value={visualizerLogoPosition}
                items={{ back: 'behind', front: 'in front' }}
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
