"""ElevenLabs TTS for narration lines (Taiwanese Mandarin, mixed English terms).

Usage:
  py -3 -X utf8 tts_eleven.py --text "句子" --voice <voice_id> --model eleven_multilingual_v2 -o out.mp3
  py -3 -X utf8 tts_eleven.py --script narration.json --voice <voice_id> --outdir ../audio/tts [--only s03,s05] [--dry-run]

narration.json: [{"id": "s01", "text": "..."}]  (one entry per slide; "say" overrides text sent to TTS)
Reads ELEVENLABS_API_KEY from env, falling back to the Windows User environment.
Skips lines whose mp3 already exists unless --force; prints character usage before spending.
"""
import argparse, json, os, subprocess, sys, urllib.request, urllib.error

API = "https://api.elevenlabs.io/v1"


def api_key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k and os.name == "nt":
        k = subprocess.run(["powershell", "-NoProfile", "-Command",
                            '[Environment]::GetEnvironmentVariable("ELEVENLABS_API_KEY","User")'],
                           capture_output=True, text=True).stdout.strip()
    if not k:
        sys.exit("ELEVENLABS_API_KEY not found")
    return k


def quota(key):
    req = urllib.request.Request(f"{API}/user/subscription", headers={"xi-api-key": key})
    d = json.load(urllib.request.urlopen(req))
    return d["tier"], d["character_count"], d["character_limit"]


def synth(key, text, voice, model, out, settings, prev=None, nxt=None):
    body = {"text": text, "model_id": model, "voice_settings": settings}
    if model != "eleven_v3":
        body["language_code"] = "zh"
        if prev: body["previous_text"] = prev
        if nxt: body["next_text"] = nxt
    req = urllib.request.Request(
        f"{API}/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        audio = urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"TTS failed ({e.code}): {e.read().decode(errors='replace')[:400]}")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(audio)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text"); ap.add_argument("--script"); ap.add_argument("-o", "--out")
    ap.add_argument("--outdir"); ap.add_argument("--voice", required=True)
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--stability", type=float, default=0.5)
    ap.add_argument("--similarity", type=float, default=0.75)
    ap.add_argument("--style", type=float, default=0.0)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--only"); ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    key = api_key()
    settings = {"stability": a.stability, "similarity_boost": a.similarity,
                "style": a.style, "use_speaker_boost": True, "speed": a.speed}

    if a.text:
        jobs = [{"id": None, "say": a.text, "out": a.out}]
    else:
        lines = json.load(open(a.script, encoding="utf-8"))
        only = set(a.only.split(",")) if a.only else None
        jobs = []
        for i, ln in enumerate(lines):
            out = os.path.join(a.outdir, f"{ln['id']}.mp3")
            if only and ln["id"] not in only: continue
            if os.path.exists(out) and not a.force and not only: continue
            jobs.append({"id": ln["id"], "say": ln.get("say") or ln["text"], "out": out,
                         "prev": lines[i - 1].get("say") or lines[i - 1]["text"] if i else None,
                         "next": (lines[i + 1].get("say") or lines[i + 1]["text"]) if i + 1 < len(lines) else None})

    need = sum(len(j["say"]) for j in jobs)
    tier, used, limit = quota(key)
    print(f"[eleven] {len(jobs)} line(s), {need} chars; plan={tier} used {used}/{limit} -> after {used + need}/{limit}")
    if used + need > limit:
        sys.exit("[eleven] would exceed monthly quota; aborting")
    if a.dry_run: return
    for j in jobs:
        synth(key, j["say"], a.voice, a.model, j["out"], settings, j.get("prev"), j.get("next"))
        print(f"[eleven] wrote {j['out']}")


if __name__ == "__main__":
    main()
