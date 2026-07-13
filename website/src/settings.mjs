import { persistentMap } from '@nanostores/persistent';
import { useStore } from '@nanostores/react';
import { register } from '@strudel/core';
import { isUdels } from './repl/util.mjs';
import { computed } from 'nanostores';

export const audioEngineTargets = {
  webaudio: 'webaudio',
  osc: 'osc',
};

export const soundFilterType = {
  USER: 'user',
  DRUMS: 'drums',
  SAMPLES: 'samples',
  SYNTHS: 'synths',
  WAVETABLES: 'wavetables',
  ALL: 'all',
};

const initialPrebakeScript = `// Prebake script
//
// This is code that is loaded before your pattern is run.
// You can use it to define custom functions to use in any pattern.
// 
// This is an initial example script. You can edit it to add 
// your own funtions.
//
// To use a script shared by some other user you can use
// the import-button or paste the script in this editor.

const ratchet = register('ratchet', (pat) => pat.sometimes(ply(2)))
`;

export const defaultSettings = {
  activeFooter: 'intro',
  keybindings: 'codemirror',
  isBracketMatchingEnabled: true,
  isBracketClosingEnabled: true,
  isLineNumbersDisplayed: true,
  isActiveLineHighlighted: true,
  isAutoCompletionEnabled: false,
  isTooltipEnabled: false,
  isFlashEnabled: true,
  isSyncEnabled: false,
  isLineWrappingEnabled: false,
  isPatternHighlightingEnabled: true,
  isTabIndentationEnabled: false,
  isMultiCursorEnabled: false,
  isBlockBasedEvalEnabled: false,
  theme: 'strudelTheme',
  fontFamily: 'monospace',
  fontSize: 18,
  latestCode: '',
  isZen: false,
  soundsFilter: soundFilterType.ALL,
  referenceTag: 'all',
  patternFilter: 'community',
  // panelPosition: window.innerWidth > 1000 ? 'right' : 'bottom', //FIX: does not work on astro
  panelPosition: 'right',
  panelWidth: 600, // px, only used when panelPosition is 'right' — drag the handle to resize
  isPanelPinned: false,
  isPanelOpen: true,
  userPatterns: '{}',
  prebakeScript: initialPrebakeScript,
  audioEngineTarget: audioEngineTargets.webaudio,
  isButtonRowHidden: false,
  isCSSAnimationDisabled: false,
  maxPolyphony: 128,
  multiChannelOrbits: false,
  includePrebakeScriptInShare: true,
  settingsTab: 'settings',
  // visualizer (AudioMotion Analyzer)
  visualizerControlsOpen: true,
  visualizerMode: '10', // AudioMotion mode: 10 = bars
  visualizerGradient: 'prism',
  visualizerShowPeaks: true,
  visualizerRadial: false,
  visualizerAlphaBars: false,
  visualizerLumiBars: false,
  visualizerLedBars: false,
  visualizerMirror: '0', // '0' none, '-1' left, '1' right
  visualizerReflex: '0', // '0' none, '0.25' mirror, '0.5' full
  visualizerBarSpace: 0.1,
  visualizerSensitivity: 'medium', // low | medium | high
  visualizerBgAlpha: 0.7,
  visualizerSettingsHeight: 220, // px, drag the handle above the settings grid to resize
  // logo dance pacing: 'auto' (follows music energy) | '1'|'2'|'4'|'8'|'16'|'32' (note value,
  // as a fraction of the pattern's cycle length: quarter note = cycle / 4, etc.)
  visualizerDanceSpeedMode: 'auto',
  // logo overlay
  visualizerLogoImage: '', // data URL, empty = none
  visualizerLogoOpacity: 0.5,
  visualizerLogoLayer: 'front', // front | back
  visualizerLogoSize: 40, // percent of canvas width
  visualizerLogoPosition: 'center', // center | top-left | top-right | bottom-left | bottom-right
  // background video (plays behind the code editor; the file itself lives in IndexedDB,
  // see backgroundVideoStore.mjs — this is just the opacity knob)
  backgroundVideoOpacity: 0.5,
  backgroundVideoFlipped: false,
  // webcam bubble (bottom-right of the code editor, see webcamStore.mjs — the live
  // MediaStream isn't persisted, only whether it's on and how big to draw it)
  webcamEnabled: false,
  webcamSize: 160, // px diameter
  // Claude pattern bridge (dev-only, see /bridge/pattern middleware in astro.config.mjs)
  bridgeAutoEval: true,
  // user-created themes (name -> { base, settings, light }), see customThemes.mjs
  customThemes: '{}',
};

let search = null;
if (typeof window !== 'undefined') {
  search = new URLSearchParams(window.location.search);
}
// if running multiple instance in one window, it will use the settings for that instance. else default to normal
const instance = parseInt(search?.get('instance') ?? '0');
const settings_key = `strudel-settings${instance > 0 ? instance : ''}`;

export const settingsMap = persistentMap(settings_key, defaultSettings);

export const $settings = computed(settingsMap, (state) => {
  const userPatterns = JSON.parse(state.userPatterns);
  Object.keys(userPatterns).forEach((key) => {
    const data = userPatterns[key];
    if (typeof data === 'object' && data !== null) {
      data.id = data.id ?? key;
      userPatterns[key] = data;
    }
  });
  return {
    ...state,
    isZen: parseBoolean(state.isZen),
    isBracketMatchingEnabled: parseBoolean(state.isBracketMatchingEnabled),
    isBracketClosingEnabled: parseBoolean(state.isBracketClosingEnabled),
    isLineNumbersDisplayed: parseBoolean(state.isLineNumbersDisplayed),
    isActiveLineHighlighted: parseBoolean(state.isActiveLineHighlighted),
    isAutoCompletionEnabled: parseBoolean(state.isAutoCompletionEnabled),
    isPatternHighlightingEnabled: parseBoolean(state.isPatternHighlightingEnabled),
    isButtonRowHidden: parseBoolean(state.isButtonRowHidden),
    isCSSAnimationDisabled: parseBoolean(state.isCSSAnimationDisabled),
    isTooltipEnabled: parseBoolean(state.isTooltipEnabled),
    isLineWrappingEnabled: parseBoolean(state.isLineWrappingEnabled),
    isFlashEnabled: parseBoolean(state.isFlashEnabled),
    isSyncEnabled: isUdels() ? true : parseBoolean(state.isSyncEnabled),
    isTabIndentationEnabled: parseBoolean(state.isTabIndentationEnabled),
    isMultiCursorEnabled: parseBoolean(state.isMultiCursorEnabled),
    isBlockBasedEvalEnabled: parseBoolean(state.isBlockBasedEvalEnabled),
    fontSize: Number(state.fontSize),
    panelWidth: Number(state.panelWidth) || 600,
    panelPosition: state.activeFooter !== '' && !isUdels() ? state.panelPosition : 'bottom', // <-- keep this 'bottom' where it is!
    isPanelPinned: parseBoolean(state.isPanelPinned),
    isPanelOpen: parseBoolean(state.isPanelOpen),
    userPatterns: userPatterns,
    multiChannelOrbits: parseBoolean(state.multiChannelOrbits),
    includePrebakeScriptInShare: parseBoolean(state.includePrebakeScriptInShare),
    visualizerControlsOpen: parseBoolean(state.visualizerControlsOpen),
    visualizerShowPeaks: parseBoolean(state.visualizerShowPeaks),
    visualizerRadial: parseBoolean(state.visualizerRadial),
    visualizerAlphaBars: parseBoolean(state.visualizerAlphaBars),
    visualizerLumiBars: parseBoolean(state.visualizerLumiBars),
    visualizerLedBars: parseBoolean(state.visualizerLedBars),
    visualizerBarSpace: Number(state.visualizerBarSpace),
    visualizerBgAlpha: Number(state.visualizerBgAlpha),
    visualizerSettingsHeight: Number(state.visualizerSettingsHeight) || 220,
    visualizerLogoOpacity: Number(state.visualizerLogoOpacity),
    visualizerLogoSize: Number(state.visualizerLogoSize),
    backgroundVideoOpacity: Number(state.backgroundVideoOpacity),
    backgroundVideoFlipped: parseBoolean(state.backgroundVideoFlipped),
    webcamEnabled: parseBoolean(state.webcamEnabled),
    webcamSize: Number(state.webcamSize),
    patternAutoStart: isUdels()
      ? false
      : state.patternAutoStart === undefined
        ? true
        : parseBoolean(state.patternAutoStart),
    bridgeAutoEval: parseBoolean(state.bridgeAutoEval),
  };
});

export const parseBoolean = (booleanlike) => ([true, 'true'].includes(booleanlike) ? true : false);

export function useSettings() {
  const store = useStore($settings);
  return store || defaultSettings;
}

export const setActiveFooter = (tab) => settingsMap.setKey('activeFooter', tab);
export const setPanelPinned = (bool) => settingsMap.setKey('isPanelPinned', bool);
export const setIsPanelOpened = (bool) => settingsMap.setKey('isPanelOpen', bool);
export const setSettingsTab = (tab) => settingsMap.setKey('settingsTab', tab);
export const setVisualizerSetting = (key, value) => settingsMap.setKey(key, value);

export const storePrebakeScript = (script) => settingsMap.setKey('prebakeScript', script);

export const setIsZen = (active) => settingsMap.setKey('isZen', !!active);

const patternSetting = (key) =>
  register(key, (value, pat) =>
    pat.onTrigger(() => {
      value = Array.isArray(value) ? value.join(' ') : value;
      if (value !== settingsMap.get()[key]) {
        settingsMap.setKey(key, value);
      }
      return pat;
    }, false),
  );

export const theme = patternSetting('theme');
export const fontFamily = patternSetting('fontFamily');
export const fontSize = patternSetting('fontSize');

export const settingPatterns = { theme, fontFamily, fontSize };
