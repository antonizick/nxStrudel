// Dev-only bridge for the Notes tab: reads/writes `bridge/notes.md` on disk via the
// astro.config.mjs `/bridge/notes` route, the same mechanism the pattern bridge uses.

export async function loadNotes() {
  const res = await fetch('/bridge/notes');
  if (!res.ok) throw new Error(`failed to load notes (${res.status})`);
  const { code } = await res.json();
  return code ?? '';
}

export async function saveNotes(code) {
  const res = await fetch('/bridge/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`failed to save notes (${res.status})`);
}
