import { defaultSettings, settingsMap, useSettings, storePrebakeScript, setSettingsTab } from '../../../settings.mjs';
import { themes, activateTheme } from '@strudel/codemirror';
import { PrebakeCodeMirror } from '../../../repl/prebakeCodeMirror.mjs';
import { confirmAndReloadPage, isUdels } from '../../util.mjs';
import { ButtonGroup } from './Forms.jsx';
import { AudioDeviceSelector } from './AudioDeviceSelector.jsx';
import { AudioEngineTargetSelector } from './AudioEngineTargetSelector.jsx';
import { confirmDialog } from '../../util.mjs';
import { DEFAULT_MAX_POLYPHONY, setMaxPolyphony, setMultiChannelOrbits } from '@strudel/webaudio';
import { ActionButton } from '../button/action-button.jsx';
import { exportScript, ImportPrebakeScriptButton } from './ImportPrebakeScriptButton.jsx';
import { useEffect, useRef, useState } from 'react';
import cx from '@src/cx.mjs';
import {
  COLOR_KEYS,
  getCustomThemes,
  getBaseThemeSettings,
  saveCustomTheme,
  deleteCustomTheme,
  previewTheme,
  discardPreview,
  PREVIEW_THEME_NAME,
} from '../../customThemes.mjs';

const inputClass =
  'bg-background text-xs h-8 max-h-8 border border-box rounded-0 text-foreground border-muted placeholder-muted focus:outline-none focus:ring-0 focus:border-foreground';

export function Textbox({ onChange, className, ...inputProps }) {
  return (
    <input className={cx('px-2', inputClass, className)} onChange={(e) => onChange(e.target.value)} {...inputProps} />
  );
}

function Checkbox({ label, value, onChange, disabled = false }) {
  return (
    <label className="text-xs">
      <input
        className={cx(
          'bg-background text-sm border border-muted focus:outline-none focus:ring-0 focus:border-foreground',
        )}
        disabled={disabled}
        type="checkbox"
        checked={value}
        onChange={onChange}
      />
      {' ' + label}
    </label>
  );
}

//      value: ?ID, options: Map<ID, any>, onChange: ID => null, onClick: event => void, isDisabled: boolean
export function SelectInputDuplicate({ value, options, onChange, onClick, isDisabled }) {
  return (
    <select
      disabled={isDisabled}
      onClick={onClick}
      className={cx('p-2', inputClass)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.size == 0 && <option value={value}>{`${value ?? 'select an option'}`}</option>}
      {Array.from(options.keys()).map((id) => (
        <option key={id} className="bg-background" value={id}>
          {options.get(id)}
        </option>
      ))}
    </select>
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select className={cx('p-2', inputClass)} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, label]) => (
        <option key={k} className="bg-background" value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function NumberSlider({ value, onChange, step = 1, ...rest }) {
  return (
    <div className="flex space-x-2 gap-1 overflow-hidden">
      <input
        className="p-2 grow accent-foreground"
        type="range"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        {...rest}
      />
      <input
        type="number"
        value={value}
        step={step}
        className={cx('w-16', inputClass)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function FormItem({ label, children, sublabel }) {
  return (
    <div className="grid gap-2 text-xs">
      <label className="text-sm">{label}</label>
      {children}
    </div>
  );
}

const fontFamilyOptions = {
  monospace: 'monospace',
  Courier: 'Courier',
  CutiePi: 'CutiePi',
  JetBrains: 'JetBrains',
  Hack: 'Hack',
  FiraCode: 'FiraCode',
  'FiraCode-SemiBold': 'FiraCode SemiBold',
  teletext: 'teletext',
  tic80: 'tic80',
  mode7: 'mode7',
  BigBlueTerminal: 'BigBlueTerminal',
  x3270: 'x3270',
  Monocraft: 'Monocraft',
  PressStart: 'PressStart2P',
  'we-come-in-peace': 'we-come-in-peace',
  galactico: 'galactico',
};

// Best-effort CSS color -> "#rrggbb" for <input type="color">, which only accepts that exact
// format. Uses the browser's own color parser (via canvas) so named colors / rgba / short hex
// all resolve; alpha is dropped since the color input can't represent it.
function toHex(css) {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillStyle = css;
    const out = ctx.fillStyle;
    if (/^#[0-9a-f]{6}$/i.test(out)) {
      return out;
    }
    const m = out.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) {
      return '#' + m.slice(1, 4).map((v) => (+v).toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to default below
  }
  return '#000000';
}

function ThemeColorField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-10 border border-muted bg-background"
      />
    </label>
  );
}

function ThemeEditorForm({ baseTheme, editingName, editorRef, onSave, onCancel }) {
  // `baseTheme` is whatever theme was actually active when this form opened — the color seed
  // for a brand new duplicate, and (regardless of new/edit) exactly what Cancel should revert to
  const existing = editingName ? getCustomThemes()[editingName] : null;
  const seed = existing?.settings || getBaseThemeSettings(existing?.base || baseTheme);
  const [name, setName] = useState(editingName || `${baseTheme}-copy`);
  const [light, setLight] = useState(existing ? !!existing.light : !!seed.light);
  const [colors, setColors] = useState(() => Object.fromEntries(COLOR_KEYS.map((k) => [k, toHex(seed[k])])));

  // live preview: apply every color/light change immediately, without touching persisted state
  useEffect(() => {
    previewTheme({ base: existing?.base || baseTheme, settings: colors, light });
    editorRef?.current?.setTheme(PREVIEW_THEME_NAME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, light]);

  const handleCancel = () => {
    discardPreview();
    activateTheme(baseTheme, true);
    editorRef?.current?.setTheme(baseTheme);
    onCancel();
  };

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    discardPreview();
    onSave(name.trim(), { base: existing?.base || baseTheme, settings: colors, light });
  };

  return (
    <div className="border border-muted p-2 space-y-2">
      <Textbox value={name} onChange={setName} placeholder="theme name" />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} />
        <span>Light theme</span>
      </label>
      <div className="grid grid-cols-2 gap-1">
        {COLOR_KEYS.map((key) => (
          <ThemeColorField
            key={key}
            label={key}
            value={colors[key]}
            onChange={(v) => setColors((c) => ({ ...c, [key]: v }))}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <ActionButton className="bg-background p-2 hover:opacity-50" onClick={handleSave}>
          save
        </ActionButton>
        <ActionButton className="bg-background p-2 hover:opacity-50" onClick={handleCancel}>
          cancel
        </ActionButton>
      </div>
    </div>
  );
}

function CustomThemeManager({ currentTheme, editorRef }) {
  const [editing, setEditing] = useState(null); // null | 'new' | <existing theme name>
  const custom = getCustomThemes();
  const names = Object.keys(custom);

  if (editing) {
    return (
      <ThemeEditorForm
        baseTheme={currentTheme}
        editingName={editing === 'new' ? null : editing}
        editorRef={editorRef}
        onSave={(name, def) => {
          saveCustomTheme(name, def);
          settingsMap.setKey('theme', name);
          // settingsMap.setKey is a no-op if `theme` is already `name` (editing the active theme) —
          // its underlying color definition just changed though, so force CodeMirror to reconfigure
          // regardless of whether the setting value itself changed
          editorRef?.current?.setTheme(name);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-1">
      <ActionButton className="bg-background p-2 hover:opacity-50" onClick={() => setEditing('new')}>
        duplicate "{currentTheme}" as new theme
      </ActionButton>
      {names.map((name) => (
        <div key={name} className="flex items-center justify-between text-xs gap-2">
          <span>{name}</span>
          <div className="flex gap-2">
            <ActionButton onClick={() => setEditing(name)}>edit</ActionButton>
            <ActionButton
              onClick={() => {
                deleteCustomTheme(name);
                if (currentTheme === name) {
                  settingsMap.setKey('theme', 'strudelTheme');
                }
              }}
            >
              delete
            </ActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function MainSettingsContent({ started, editorRef }) {
  const {
    theme,
    keybindings,
    isBracketClosingEnabled,
    isBracketMatchingEnabled,
    isLineNumbersDisplayed,
    isPatternHighlightingEnabled,
    isActiveLineHighlighted,
    isAutoCompletionEnabled,
    isTooltipEnabled,
    isFlashEnabled,
    isButtonRowHidden,
    isCSSAnimationDisabled,
    isSyncEnabled,
    isLineWrappingEnabled,
    fontSize,
    fontFamily,
    panelPosition,
    audioDeviceName,
    audioEngineTarget,
    maxPolyphony,
    multiChannelOrbits,
    isTabIndentationEnabled,
    isMultiCursorEnabled,
    patternAutoStart,
    isBlockBasedEvalEnabled,
    bridgeAutoEval,
  } = useSettings();
  const shouldAlwaysSync = isUdels();
  const canChangeAudioDevice = AudioContext.prototype.setSinkId != null;
  const themeOptions = Object.fromEntries(Object.keys(themes).map((k) => [k, k]));
  return (
    <div className="p-4 text-foreground space-y-4 w-full overflow-auto" style={{ fontFamily }}>
      {canChangeAudioDevice && (
        <FormItem label="Audio Output Device">
          <AudioDeviceSelector
            isDisabled={started}
            audioDeviceName={audioDeviceName}
            onChange={(audioDeviceName) => {
              confirmAndReloadPage(() => {
                settingsMap.setKey('audioDeviceName', audioDeviceName);
              });
            }}
          />
        </FormItem>
      )}
      <FormItem label="Audio Engine Target">
        <AudioEngineTargetSelector
          target={audioEngineTarget}
          onChange={(target) => {
            confirmAndReloadPage(() => {
              settingsMap.setKey('audioEngineTarget', target);
            });
          }}
        />
      </FormItem>

      <FormItem label="Maximum Polyphony">
        <Textbox
          min={1}
          max={Infinity}
          onBlur={(e) => {
            let v = parseInt(e.target.value);
            v = isNaN(v) ? DEFAULT_MAX_POLYPHONY : v;
            setMaxPolyphony(v);
            settingsMap.setKey('maxPolyphony', v);
          }}
          onChange={(v) => {
            v = Math.max(1, parseInt(v));
            settingsMap.setKey('maxPolyphony', isNaN(v) ? undefined : v);
          }}
          type="number"
          placeholder=""
          value={maxPolyphony ?? ''}
        />
      </FormItem>
      <FormItem>
        <Checkbox
          label="Multi Channel Orbits"
          onChange={(cbEvent) => {
            const val = cbEvent.target.checked;
            confirmAndReloadPage(() => {
              settingsMap.setKey('multiChannelOrbits', val);
              setMultiChannelOrbits(val);
            });
          }}
          value={multiChannelOrbits}
        />
      </FormItem>
      <FormItem label="Theme">
        <SelectInput options={themeOptions} value={theme} onChange={(theme) => settingsMap.setKey('theme', theme)} />
      </FormItem>
      <FormItem label="Custom Themes">
        <CustomThemeManager currentTheme={theme} editorRef={editorRef} />
      </FormItem>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormItem label="Font Family">
          <SelectInput
            options={fontFamilyOptions}
            value={fontFamily}
            onChange={(fontFamily) => settingsMap.setKey('fontFamily', fontFamily)}
          />
        </FormItem>
        <FormItem label="Font Size">
          <NumberSlider
            value={fontSize}
            onChange={(fontSize) => settingsMap.setKey('fontSize', fontSize)}
            min={10}
            max={40}
            step={2}
          />
        </FormItem>
      </div>

      <FormItem label="Keybindings">
        <ButtonGroup
          value={keybindings}
          onChange={(keybindings) => settingsMap.setKey('keybindings', keybindings)}
          items={{ codemirror: 'Codemirror', vim: 'Vim', emacs: 'Emacs', helix: 'Helix', vscode: 'VSCode' }}
        ></ButtonGroup>
      </FormItem>
      <FormItem label="Panel Position">
        <ButtonGroup
          value={panelPosition}
          onChange={(value) => settingsMap.setKey('panelPosition', value)}
          items={{ bottom: 'Bottom', right: 'Right' }}
        ></ButtonGroup>
      </FormItem>
      <FormItem label="More Settings">
        <Checkbox
          label="Enable bracket matching"
          onChange={(cbEvent) => settingsMap.setKey('isBracketMatchingEnabled', cbEvent.target.checked)}
          value={isBracketMatchingEnabled}
        />
        <Checkbox
          label="Auto close brackets"
          onChange={(cbEvent) => settingsMap.setKey('isBracketClosingEnabled', cbEvent.target.checked)}
          value={isBracketClosingEnabled}
        />
        <Checkbox
          label="Display line numbers"
          onChange={(cbEvent) => settingsMap.setKey('isLineNumbersDisplayed', cbEvent.target.checked)}
          value={isLineNumbersDisplayed}
        />
        <Checkbox
          label="Highlight active line"
          onChange={(cbEvent) => settingsMap.setKey('isActiveLineHighlighted', cbEvent.target.checked)}
          value={isActiveLineHighlighted}
        />
        <Checkbox
          label="Highlight events in code"
          onChange={(cbEvent) => settingsMap.setKey('isPatternHighlightingEnabled', cbEvent.target.checked)}
          value={isPatternHighlightingEnabled}
        />
        <Checkbox
          label="Enable auto-completion"
          onChange={(cbEvent) => settingsMap.setKey('isAutoCompletionEnabled', cbEvent.target.checked)}
          value={isAutoCompletionEnabled}
        />
        <Checkbox
          label="Enable tooltips on Ctrl and hover"
          onChange={(cbEvent) => settingsMap.setKey('isTooltipEnabled', cbEvent.target.checked)}
          value={isTooltipEnabled}
        />
        <Checkbox
          label="Enable line wrapping"
          onChange={(cbEvent) => settingsMap.setKey('isLineWrappingEnabled', cbEvent.target.checked)}
          value={isLineWrappingEnabled}
        />
        <Checkbox
          label="Enable Tab indentation"
          onChange={(cbEvent) => settingsMap.setKey('isTabIndentationEnabled', cbEvent.target.checked)}
          value={isTabIndentationEnabled}
        />
        <Checkbox
          label="Enable Multi-Cursor (Cmd/Ctrl+Click)"
          onChange={(cbEvent) => settingsMap.setKey('isMultiCursorEnabled', cbEvent.target.checked)}
          value={isMultiCursorEnabled}
        />
        <Checkbox
          label="Enable Block-based Evaluation (EXPERIMENTAL)"
          onChange={(cbEvent) => settingsMap.setKey('isBlockBasedEvalEnabled', cbEvent.target.checked)}
          value={isBlockBasedEvalEnabled}
        />
        <Checkbox
          label="Enable flashing on evaluation"
          onChange={(cbEvent) => settingsMap.setKey('isFlashEnabled', cbEvent.target.checked)}
          value={isFlashEnabled}
        />
        <Checkbox
          label="Sync across Browser Tabs / Windows"
          onChange={(cbEvent) => {
            const newVal = cbEvent.target.checked;
            confirmAndReloadPage(() => {
              settingsMap.setKey('isSyncEnabled', newVal);
            });
          }}
          disabled={shouldAlwaysSync}
          value={isSyncEnabled}
        />
        <Checkbox
          label="Hide action buttons"
          onChange={(cbEvent) => settingsMap.setKey('isButtonRowHidden', cbEvent.target.checked)}
          value={isButtonRowHidden}
        />
        <Checkbox
          label="Disable CSS Animations"
          onChange={(cbEvent) => settingsMap.setKey('isCSSAnimationDisabled', cbEvent.target.checked)}
          value={isCSSAnimationDisabled}
        />
        <Checkbox
          label="Auto-start pattern on pattern change"
          onChange={(cbEvent) => settingsMap.setKey('patternAutoStart', cbEvent.target.checked)}
          value={patternAutoStart}
        />
        <Checkbox
          label="Auto-evaluate patterns from Claude bridge"
          onChange={(cbEvent) => settingsMap.setKey('bridgeAutoEval', cbEvent.target.checked)}
          value={bridgeAutoEval}
        />
      </FormItem>
      <FormItem label="Zen Mode">Try clicking the logo in the top left!</FormItem>
      <FormItem label="Reset Settings">
        <ActionButton
          onClick={() => {
            confirmDialog('Sure?').then((r) => {
              if (r) {
                const { userPatterns } = settingsMap.get(); // keep current patterns
                settingsMap.set({ ...defaultSettings, userPatterns });
              }
            });
          }}
          className="bg-background p-2 max-w-[300px] hover:opacity-50"
        >
          restore default settings
        </ActionButton>
      </FormItem>
    </div>
  );
}

function PrebakeSettingsContent() {
  const { fontFamily, includePrebakeScriptInShare, prebakeScript } = useSettings();
  const editorRef = useRef();
  useEffect(() => {
    return () => {
      editorRef.current?.cleanup();
    };
  });

  return (
    <div className="flex flex-col h-full text-foreground w-full overflow-auto" style={{ fontFamily }}>
      <div className="flex flex-col grow overflow-hidden h-full bg-background">
        <section
          className="pb-0 overflow-auto grow z-10 code-container"
          ref={(el) => {
            if (editorRef.current) {
              return;
            }
            editorRef.current = new PrebakeCodeMirror(prebakeScript, (code) => storePrebakeScript(code), el);
          }}
        ></section>
      </div>
      <div className="flex justify-between items-center border-t border-muted px-4 whitespace-nowrap">
        <Checkbox
          label="share with patterns"
          className="whitespace-nowrap max-w-[200px]"
          onChange={(cbEvent) => settingsMap.setKey('includePrebakeScriptInShare', cbEvent.target.checked)}
          value={includePrebakeScriptInShare}
        />
        <div className="py-2 flex flex-row items-center space-x-3 ">
          <ImportPrebakeScriptButton updateEditor={(code) => editorRef?.current.setCode(code)} />
          <ActionButton onClick={() => exportScript(prebakeScript)}>export</ActionButton>
          <ActionButton onClick={() => editorRef.current?.savePrebake()}>save</ActionButton>
        </div>
      </div>
    </div>
  );
}
export function SettingsTab({ started, editorRef }) {
  const { settingsTab } = useSettings();
  return (
    <div className="w-full h-full text-foreground flex flex-col overflow-hidden">
      <div className="px-2 shrink-0 h-8 space-x-4 flex max-w-full overflow-x-auto border-b border-muted">
        <ButtonGroup
          wrap
          value={settingsTab}
          onChange={(value) => setSettingsTab(value)}
          items={{
            settings: 'settings',
            prebake: 'prebake',
          }}
        ></ButtonGroup>
      </div>
      {settingsTab === 'settings' && <MainSettingsContent started={started} editorRef={editorRef} />}
      {settingsTab === 'prebake' && <PrebakeSettingsContent />}
    </div>
  );
}
