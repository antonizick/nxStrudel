import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import cx from '@src/cx.mjs';
import { useSettings } from '@src/settings.mjs';
import { loadNotes, saveNotes } from '../../notesBridge.mjs';

const SAVE_DEBOUNCE_MS = 600;

export function NotesTab() {
  const { fontFamily } = useSettings();
  const [content, setContent] = useState('');
  const [mode, setMode] = useState('preview');
  const [status, setStatus] = useState('loading'); // loading | ready | saving | saved | error
  const [error, setError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadNotes()
      .then((code) => {
        if (cancelled) return;
        setContent(code);
        setStatus('ready');
        if (!code) setMode('edit'); // nothing to preview yet, start in edit mode
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
    };
  }, []);

  const scheduleSave = (next) => {
    setContent(next);
    setStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes(next)
        .then(() => setStatus('saved'))
        .catch((err) => {
          setError(err.message);
          setStatus('error');
        });
    }, SAVE_DEBOUNCE_MS);
  };

  const statusLabel = { loading: 'loading...', saving: 'saving...', saved: 'saved', error: 'save failed', ready: '' }[
    status
  ];

  return (
    <div className="w-full h-full flex flex-col text-foreground" style={{ fontFamily }}>
      <div className="shrink-0 flex items-center justify-between border-b border-muted px-2 h-8 text-xs">
        <div className="flex space-x-0">
          <button
            className={cx(
              'px-2 h-8 border-b-2 hover:opacity-50',
              mode === 'preview' ? 'border-foreground' : 'border-transparent',
            )}
            onClick={() => setMode('preview')}
          >
            preview
          </button>
          <button
            className={cx(
              'px-2 h-8 border-b-2 hover:opacity-50',
              mode === 'edit' ? 'border-foreground' : 'border-transparent',
            )}
            onClick={() => setMode('edit')}
          >
            edit
          </button>
        </div>
        <span className={cx('opacity-50', status === 'error' && 'text-red-500 opacity-100')}>
          {statusLabel}
          {error && status === 'error' && `: ${error}`}
        </span>
      </div>
      <div className="grow overflow-auto">
        {mode === 'edit' ? (
          <textarea
            className="w-full h-full resize-none bg-background text-foreground text-sm p-3 focus:outline-none font-mono"
            value={content}
            placeholder="# Notes&#10;&#10;Write markdown here..."
            onChange={(e) => scheduleSave(e.target.value)}
            spellCheck={false}
          />
        ) : content ? (
          <div
            className="prose dark:prose-invert min-w-full px-4 py-3 text-sm"
            dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
          />
        ) : (
          <div className="p-4 text-xs opacity-50">No notes yet. Switch to "edit" to write some.</div>
        )}
      </div>
    </div>
  );
}
