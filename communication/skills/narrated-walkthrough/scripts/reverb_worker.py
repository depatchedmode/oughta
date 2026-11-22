"""
Reverb-TTS worker for narrated-walkthrough. Reads one JSON request on stdin, writes one JSON result on stdout.
Progress and errors go to stderr.

  {"op": "presets"}                        preset voice names (needs the network, not the model)
  {"op": "load"}                           load the model, downloading it if needed (setup.sh)
  {"op": "prepare", "language": "en", "texts": ["..."]}
  {"op": "clone", "audio": "/abs/ref.wav", "text": "transcript", "language": "en",
   "npz": "/abs/out.npz", "test": "/abs/test.wav", "line": "a test line"}
  {"op": "synth", "variant": "int8", "jobs": [
      {"text": "...", "out": "/abs/x.wav", "meta": "/abs/x.wav.json",
       "voice": "en_female_narrator" | "/abs/voice.npz" | {"audio": "/abs/ref.wav", "text": "transcript"},
       "language": "en", "speed": 1.0, "seed": 7, "steps": 8}]}

Each synth job's meta file ({"seconds", "spoken"}) is written as soon as its audio is, so a batch
that fails partway keeps what it finished.

Run with the skill's virtualenv: <home>/venv/bin/python -I reverb_worker.py
"""

import json
import sys
import time
import warnings

warnings.filterwarnings("ignore")


def log(*args):
    print(*args, file=sys.stderr, flush=True)


def main():
    req = json.load(sys.stdin)
    op = req.get("op")

    if op == "prepare":
        from reverb_tts.text import prepare_text

        lang = req.get("language", "en")
        print(json.dumps({"texts": [prepare_text(t, lang) for t in req["texts"]]}))
        return

    if op == "presets":
        from huggingface_hub import list_repo_files
        from reverb_tts.tts import PRESETS

        files = list_repo_files(PRESETS)
        names = sorted(f[len("voices/"):-len(".json")] for f in files if f.startswith("voices/") and f.endswith(".json"))
        print(json.dumps({"voices": names}))
        return

    import soundfile as sf
    from reverb_tts import TTS, Voice
    from reverb_tts.text import prepare_text

    t0 = time.time()
    tts = TTS.from_pretrained(variant=req.get("variant", "int8"))
    log(f"reverb: model loaded in {time.time() - t0:.1f}s on {tts.device}")

    if op == "load":
        print(json.dumps({"device": str(tts.device)}))
        return

    if op == "clone":
        lang = req.get("language", "en")
        voice = tts.voice(req["audio"], req["text"], language=lang)
        voice.save(req["npz"])
        sf.write(req["test"], tts.generate(req["line"], voice, language=lang, seed=7), tts.sample_rate)
        print(json.dumps({"npz": req["npz"], "test": req["test"]}))
        return

    if op != "synth":
        raise SystemExit(f"unknown op {op!r}")

    voices = {}

    def resolve(spec, language):
        key = json.dumps(spec, sort_keys=True)
        if key not in voices:
            if isinstance(spec, dict):
                voices[key] = tts.voice(spec["audio"], spec["text"], language=spec.get("language", language))
            elif str(spec).endswith(".npz"):
                voices[key] = Voice.load(spec)
            elif tts.presets is not None:
                voices[key] = Voice.load(tts.presets / f"{spec}.json")
            else:
                # Not tts.preset_voice, which lists the presets online first: the build has already
                # checked the name, and hf_hub_download uses its cache when offline.
                from huggingface_hub import hf_hub_download
                from reverb_tts.tts import PRESETS

                voices[key] = Voice.load(hf_hub_download(PRESETS, f"voices/{spec}.json", token=tts.token))
        return voices[key]

    results = []
    jobs = req["jobs"]
    for i, job in enumerate(jobs, 1):
        lang = job.get("language", "en")
        name = job["voice"] if isinstance(job["voice"], str) else "cloned voice"
        t = time.time()
        try:
            voice = resolve(job["voice"], lang)
            kwargs = {"seed": job.get("seed"), "speed": job.get("speed", 1.0)}
            if job.get("steps"):
                kwargs["steps"] = job["steps"]
            audio = tts.generate(job["text"], voice, language=lang, **kwargs)
            sf.write(job["out"], audio, tts.sample_rate)
        except Exception as e:
            raise SystemExit(f"reverb: segment {i} of {len(jobs)} failed (voice {name!r}, text {job['text'][:60]!r}): {e}")
        result = {"seconds": len(audio) / tts.sample_rate, "spoken": prepare_text(job["text"], lang)}
        if job.get("meta"):
            with open(job["meta"], "w") as f:
                json.dump(result, f)
        log(f"reverb: {i}/{len(jobs)} {result['seconds']:.1f}s audio in {time.time() - t:.1f}s")
        results.append(result)

    print(json.dumps({"results": results}))


if __name__ == "__main__":
    main()
