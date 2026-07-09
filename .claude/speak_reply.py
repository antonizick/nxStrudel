#!/usr/bin/env python3
"""Stop hook: speak the model's final text reply through the Lucent voice box.

Lets a weak local model focus on its ONE reliable action (editing the pattern file);
the voice happens automatically here, using the model's own words. Reads the last
assistant text from the transcript, strips it to clean prose, and pipes it to say.sh.
Always exits 0 so it can never block the session.
"""
import sys, json, re, subprocess, os

SAY = "/home/nick/dev/lucent/idea/_workingArea/strudel/strudel/say.sh"

def last_assistant_text(transcript_path):
    with open(transcript_path) as f:
        lines = f.readlines()
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except Exception:
            continue
        if rec.get("type") != "assistant":
            continue
        parts = (rec.get("message") or {}).get("content") or []
        chunks = [p.get("text", "") for p in parts
                  if isinstance(p, dict) and p.get("type") == "text"]
        text = " ".join(c for c in chunks if c.strip())
        if text.strip():
            return text
    return None

def looks_like_json_toolcall(text):
    t = text.lstrip()
    if t[:2] in ('[{', '{"'):
        return True
    if '"name"' in text and '"arguments"' in text:
        return True
    return False

def clean_for_speech(text):
    # A weak model sometimes emits a tool call as raw text JSON — never speak that.
    if looks_like_json_toolcall(text):
        return ""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)   # fenced code
    text = re.sub(r"`[^`]*`", " ", text)                 # inline code
    text = re.sub(r"^\s*voice sent[.:]?\s*", "", text, flags=re.I)  # legacy echo
    text = re.sub(r"[*_#>`|]", " ", text)                # markdown symbols
    text = re.sub(r"^\s*[-•]\s*", " ", text, flags=re.M) # bullets
    text = re.sub(r"\s+", " ", text).strip()
    return text[:280]

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    tpath = data.get("transcript_path")
    if not tpath or not os.path.exists(tpath):
        return
    try:
        text = last_assistant_text(tpath)
    except Exception:
        return
    if not text:
        return
    text = clean_for_speech(text)
    if not text:
        return
    try:
        subprocess.run(["bash", SAY, text], timeout=30, capture_output=True)
    except Exception:
        pass

if __name__ == "__main__":
    main()
    sys.exit(0)
