"""Whisper back-check: transcribe narration mp3s and score against the intended text.

Usage:
  py -3 -X utf8 listen_back.py --files a.mp3 b.mp3 --ref "原文"
  py -3 -X utf8 listen_back.py --script narration.json --dir ../audio/tts [--report ../qa/listen_back.md]

CER is computed on Chinese characters + lower-cased ASCII words after stripping punctuation.
English terms are reported separately: Whisper is not proof of correct pronunciation, so they
always go to the human listening list.
"""
import argparse, json, os, re, subprocess, sys
import requests
from opencc import OpenCC

S2T = OpenCC("s2twp")


def api_key():
    k = os.environ.get("OPENAI_API_KEY")
    if not k and os.name == "nt":
        k = subprocess.run(["powershell", "-NoProfile", "-Command",
                            '[Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")'],
                           capture_output=True, text=True).stdout.strip()
    return k


def transcribe(path, key, prompt):
    with open(path, "rb") as f:
        r = requests.post("https://api.openai.com/v1/audio/transcriptions",
                          headers={"Authorization": f"Bearer {key}"},
                          files={"file": (os.path.basename(path), f, "audio/mpeg")},
                          data={"model": "whisper-1", "language": "zh", "prompt": prompt})
    r.raise_for_status()
    return S2T.convert(r.json()["text"])


def tokens(s):
    s = s.lower()
    return re.findall(r"[a-z0-9]+|[一-鿿]", s)


def cer(ref, hyp):
    a, b = tokens(ref), tokens(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return d[len(b)] / max(1, len(a))


def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                 "-of", "csv=p=0", path], capture_output=True, text=True).stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--files", nargs="*"); ap.add_argument("--ref")
    ap.add_argument("--script"); ap.add_argument("--dir"); ap.add_argument("--report")
    a = ap.parse_args()
    key = api_key()
    if a.script:
        lines = json.load(open(a.script, encoding="utf-8"))
        jobs = [(os.path.join(a.dir, f"{l['id']}.mp3"), l["text"]) for l in lines]
    else:
        jobs = [(f, a.ref) for f in a.files]
    rows = []
    for path, ref in jobs:
        hyp = transcribe(path, key, "以下是台灣國語的失智症照顧衛教旁白。")
        dur = duration(path)
        zh = len(re.findall(r"[一-鿿]", ref))
        eng = sorted(set(re.findall(r"[A-Za-z][A-Za-z\-]+", ref)))
        rows.append((os.path.basename(path), cer(ref, hyp), zh / dur, eng, hyp))
        flag = "CHECK" if rows[-1][1] > 0.08 else "ok"
        print(f"{rows[-1][0]}  CER={rows[-1][1]:.1%}  {rows[-1][2]:.1f} 字/秒  [{flag}]\n   聽寫：{hyp}")
    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            f.write("| 檔案 | CER | 字/秒 | 英文術語（需人工試聽） | 聽寫 |\n|---|---|---|---|---|\n")
            for n, c, sp, eng, hyp in rows:
                f.write(f"| {n} | {c:.1%} | {sp:.1f} | {', '.join(eng)} | {hyp} |\n")
        print(f"report -> {a.report}")


if __name__ == "__main__":
    main()
