// Lets Nick duplicate a built-in theme and tweak its base colors, saved under a new name.
// `themes` (CodeMirror extensions) and `settings` (flat color maps, also used for the app's
// own CSS variables via activateTheme in themes.mjs) are plain mutable objects exported by
// @strudel/codemirror — adding a key to each at runtime is how a custom theme becomes
// selectable through the existing theme dropdown/lookup, no core changes needed beyond that.
import { createTheme, themes, settings as themeSettingsMap, activateTheme } from '@strudel/codemirror';
import { settingsMap } from '../settings.mjs';

export const COLOR_KEYS = [
  'background',
  'lineBackground',
  'foreground',
  'muted',
  'caret',
  'selection',
  'selectionMatch',
  'lineHighlight',
  'gutterBackground',
  'gutterForeground',
];

export function getCustomThemes() {
  try {
    return JSON.parse(settingsMap.get().customThemes || '{}');
  } catch {
    return {};
  }
}

export function getBaseThemeSettings(baseName) {
  return themeSettingsMap[baseName] || themeSettingsMap.strudelTheme;
}

function buildAndRegister(name, { base, settings, light }) {
  const baseExt = themes[base] || themes.strudelTheme;
  // empty styles: only overriding editor chrome (background/caret/selection/etc), keeping
  // the base theme's syntax highlighting (keywords, strings, ...) untouched
  const override = createTheme({ theme: light ? 'light' : 'dark', settings, styles: [] });
  themes[name] = [].concat(baseExt, override);
  themeSettingsMap[name] = { ...settings, light };
}

export function registerCustomThemes() {
  Object.entries(getCustomThemes()).forEach(([name, def]) => buildAndRegister(name, def));
}

export function saveCustomTheme(name, def) {
  const custom = getCustomThemes();
  custom[name] = def;
  settingsMap.setKey('customThemes', JSON.stringify(custom));
  buildAndRegister(name, def);
  // force: editing a theme that's already the active one changes its definition in place, which
  // settingsMap.setKey('theme', name) alone won't notice (the value didn't change) or re-apply
  activateTheme(name, true);
}

export function deleteCustomTheme(name) {
  const custom = getCustomThemes();
  delete custom[name];
  settingsMap.setKey('customThemes', JSON.stringify(custom));
  delete themes[name];
  delete themeSettingsMap[name];
}

// Scratch key for live-previewing color edits without touching the persisted `customThemes`
// setting — lets the editor form apply colors as the user drags, and cleanly discard them on
// cancel without ever having written anything real.
export const PREVIEW_THEME_NAME = '__theme_preview__';

export function previewTheme(def) {
  buildAndRegister(PREVIEW_THEME_NAME, def);
  activateTheme(PREVIEW_THEME_NAME, true);
}

export function discardPreview() {
  delete themes[PREVIEW_THEME_NAME];
  delete themeSettingsMap[PREVIEW_THEME_NAME];
}
