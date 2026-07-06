// Claude pattern bridge: polls /bridge/pattern (see astro.config.mjs) so a pattern written
// to bridge/pattern.strudel by Claude Code shows up live in the editor, and edits made in
// the browser get written back to the same file. Browser edits always win on conflict —
// Nick is the one at the instrument.
import { setInterval, clearInterval } from 'worker-timers';
import { settingsMap } from '../settings.mjs';

const POLL_MS = 1000;
const IDLE_MS = 1500; // hold off applying incoming changes this long after the user's last keystroke

let timer = null;
let lastKnownMtime = 0;
let lastPushedCode = null;
let lastLocalEditAt = 0;

async function pull(editorRef) {
  if (Date.now() - lastLocalEditAt < IDLE_MS) return; // mid-typing, unevaluated — don't clobber the buffer
  let res;
  try {
    res = await fetch('/bridge/pattern');
  } catch {
    return; // dev server not reachable yet / mid-restart
  }
  if (!res.ok) return;
  const { code, mtimeMs } = await res.json();
  if (mtimeMs <= lastKnownMtime) return;
  lastKnownMtime = mtimeMs;
  if (!code || code === lastPushedCode || code === editorRef.current?.code) return;

  lastPushedCode = code;
  editorRef.current?.setCode(code);
  if (settingsMap.get().bridgeAutoEval && editorRef.current?.repl?.state?.started) {
    editorRef.current.evaluate();
  }
}

export function startPatternBridge(editorRef) {
  if (timer || typeof window === 'undefined') return;
  editorRef.current?.root?.addEventListener('keydown', () => {
    lastLocalEditAt = Date.now();
  });
  timer = setInterval(() => pull(editorRef), POLL_MS);
}

export function stopPatternBridge() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function pushPatternToBridge(code) {
  if (!code || code === lastPushedCode) return;
  lastPushedCode = code;
  fetch('/bridge/pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch(() => {}); // best-effort, editor stays source of truth either way
}
