"""Generate background music with Google Lyria 3 via OpenRouter.

Usage:
  py -3 -X utf8 lyria_bgm.py --prompt "..." -o ../audio/music/bgm.mp3 [--model google/lyria-3-pro-preview] [--seed 7]

Clip ($0.04, ~30 s) for tests; Pro ($0.08, full-length piece) for the final bed.
Always instrumental: the prompt is suffixed with an instrumental-only instruction so the bed
never competes with the narration.
"""
import argparse, base64, json, os, subprocess, sys
import requests


def api_key():
    k = os.environ.get("OPENROUTER_API_KEY")
    if not k and os.name == "nt":
        k = subprocess.run(["powershell", "-NoProfile", "-Command",
                            '[Environment]::GetEnvironmentVariable("OPENROUTER_API_KEY","User")'],
                           capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("OPENROUTER_API_KEY not found")
    return k


def find_audio(obj):
    """Walk the response and return (bytes, format) for the first base64 audio payload."""
    if isinstance(obj, dict):
        if "data" in obj and isinstance(obj["data"], str) and len(obj["data"]) > 1000:
            return base64.b64decode(obj["data"]), obj.get("format", "mp3")
        url = obj.get("url") if isinstance(obj.get("url"), str) else None
        if url and url.startswith("data:audio"):
            head, b64 = url.split(",", 1)
            return base64.b64decode(b64), head.split("/")[1].split(";")[0]
        for v in obj.values():
            r = find_audio(v)
            if r: return r
    elif isinstance(obj, list):
        for v in obj:
            r = find_audio(v)
            if r: return r
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True); ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--model", default="google/lyria-3-clip-preview"); ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    body = {"model": a.model, "modalities": ["text", "audio"], "stream": True,
            "messages": [{"role": "user", "content": a.prompt + " Instrumental only, no vocals, no lyrics."}]}
    if a.seed is not None: body["seed"] = a.seed
    r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                      headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"},
                      json=body, timeout=900, stream=True)
    if r.status_code != 200:
        sys.exit(f"Lyria failed ({r.status_code}): {r.text[:600]}")
    # Audio arrives as base64 pieces in choices[].delta.audio.data across SSE events.
    chunks, fmt, usage, events = [], "mp3", {}, []
    for line in r.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"): continue
        payload = line[5:].strip()
        if payload == "[DONE]": break
        ev = json.loads(payload)
        events.append(ev)
        usage = ev.get("usage") or usage
        for ch in ev.get("choices", []):
            au = (ch.get("delta") or {}).get("audio") or {}
            if au.get("data"): chunks.append(au["data"])
            if au.get("format"): fmt = au["format"]
    if chunks:
        data = b"".join(base64.b64decode(c) for c in chunks)
    else:
        got = find_audio(events)
        if not got:
            dump = a.out + ".response.json"
            json.dump(events[-5:], open(dump, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            sys.exit(f"no audio found in stream; last events dumped to {dump}")
        data, fmt = got
    out = os.path.splitext(a.out)[0] + "." + ("mp3" if fmt in ("mpeg", "mp3") else fmt)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(data)
    print(f"[lyria] wrote {out} ({len(data)//1024} kB) cost={usage.get('cost')}")


if __name__ == "__main__":
    main()
