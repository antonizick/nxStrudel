#!/usr/bin/env python3
"""PostToolUse hook: auto-correct a weak model's common Strudel syntax mistakes.

The model supplies the *music*; this fixes the *code* deterministically after every
Write/Edit to bridge/pattern.strudel, so a musically-smart-but-sloppy model (mistral-small)
becomes usable. Conservative: only rewrites clear, unambiguous errors. Always exits 0.
"""
import sys, json, re, os

TARGET = "bridge/pattern.strudel"

def strip_fences(text):
    lines = [l for l in text.splitlines() if not re.match(r"^\s*```", l)]
    return "\n".join(lines)

def to_ascii(text):
    repl = {"—": "-", "–": "-", "•": "-", "▶": ">", "·": "-", "…": "..."}
    for k, v in repl.items():
        text = text.replace(k, v)
    text = re.sub(r"[═─━┃│┏┓┗┛]", "=", text)
    return "".join(c if ord(c) < 128 else "" for c in text)

def fix_setcpm(text):
    # bare BPM -> BPM/4 (the Strudel convention). Only when there's no operator inside.
    def repl(m):
        n = int(m.group(1))
        return "setcpm(%d/4)" % n if n >= 40 else m.group(0)
    return re.sub(r"setcpm\(\s*(\d+)\s*\)", repl, text)

def fix_toggles(text):
    text = re.sub(r"toggles\(\s*(\d+)\s*\)", r"\1", text)          # toggles(1) -> 1
    text = re.sub(r"(const\s+\w+\s*=\s*)true\b", r"\g<1>1", text)  # = true  -> = 1
    text = re.sub(r"(const\s+\w+\s*=\s*)false\b", r"\g<1>0", text) # = false -> = 0
    return text

def strip_return(text):
    return re.sub(r"^\s*return\s+", "", text, flags=re.M)          # top-level `return`

def strip_bad_methods(text):
    # methods that aren't real Strudel and would throw (gemma invents .gate)
    return re.sub(r"\.gate\([^)]*\)", "", text)

def fix_empty_stack(text):
    # gemma: `stack()` followed by chained `.useX ? layer : silence` lines -> real stack(...)
    m = re.search(r"stack\(\)\s*((?:\.\s*\w+\s*\?\s*[\w().]+\s*:\s*\w+\s*)+)", text)
    if not m:
        return text
    terns = re.findall(r"\.\s*(\w+\s*\?\s*[\w().]+\s*:\s*\w+)", m.group(1))
    if not terns:
        return text
    return text[:m.start()] + "stack(" + ", ".join(t.strip() for t in terns) + ")" + text[m.end():]

def merge_stacks(text):
    # Multiple single-line top-level stack(...) statements -> one stack(...) (only last
    # would otherwise play). Merges their inner args so every layer sounds.
    lines = text.splitlines()
    stack_idx, inners = [], []
    for i, l in enumerate(lines):
        m = re.match(r"^\s*stack\((.*)\)\s*;?\s*$", l)
        if m and m.group(1).strip():
            stack_idx.append(i)
            inners.append(m.group(1).strip().rstrip(","))
    if len(stack_idx) < 2:
        return text
    merged = "stack(" + ", ".join(inners) + ")"
    out = [l for i, l in enumerate(lines) if i not in stack_idx[:-1]]
    # replace the last (kept) stack line with the merged one
    last = stack_idx[-1] - (len(stack_idx) - 1)
    out[last] = merged
    return "\n".join(out)

def fix(text):
    text = strip_fences(text)
    text = to_ascii(text)
    text = fix_setcpm(text)
    text = fix_toggles(text)
    text = strip_return(text)
    text = strip_bad_methods(text)
    text = fix_empty_stack(text)
    text = merge_stacks(text)
    return text

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    fp = (data.get("tool_input") or {}).get("file_path", "")
    if not fp.endswith("pattern.strudel") or not os.path.exists(fp):
        return
    try:
        with open(fp) as f:
            original = f.read()
        fixed = fix(original)
        if fixed != original:
            with open(fp, "w") as f:
                f.write(fixed if fixed.endswith("\n") else fixed + "\n")
    except Exception:
        pass

if __name__ == "__main__":
    main()
    sys.exit(0)
