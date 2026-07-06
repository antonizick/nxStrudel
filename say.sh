#!/usr/bin/env bash
# Lucent voicebox helper. Usage: bash say.sh "your message"
# The /speak endpoint replies with ~1MB of base64 audio; this script discards it
# so it never floods a model's context window. ALWAYS use this, never raw curl.
if [ -z "$1" ]; then
  echo 'usage: bash say.sh "message"'
  exit 1
fi
python3 - "$*" <<'PY'
import json, sys, urllib.request
try:
    req = urllib.request.Request(
        "http://localhost:8001/speak",
        data=json.dumps({"text": sys.argv[1]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=20).read()
    print("voice sent")
except Exception as e:
    print(f"voice FAILED ({e}) - tell Nick in your text response; check http://localhost:8001/services/health")
PY
