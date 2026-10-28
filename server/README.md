# Optional Quran ASR backend

The browser integration is implemented in release 30. This directory is a **separate inference service**; publishing GitHub Pages does not deploy or activate it. The default browser engine remains available. No hosted inference URL or access token is included in the application.

## Model and limitations

The service loads `rakansuliman/tadabur-whisper-medium` at immutable revision `e82c2d827ad0df27e31042f7fb87c73df1da2c8b`, using standard Transformers Whisper classes and Safetensors, with remote code disabled. Only transcription is used. The model's Hafs verse index and reciter classifier are not used for navigation: all matching stays against Athman's existing 6,214-verse Warsh source.

The [model card](https://huggingface.co/rakansuliman/tadabur-whisper-medium) reports 4.46% WER on its held-out-surah evaluation, says the output is undiacritized, and identifies standard Hafs as its target with other readings untested. Those numbers are not a measurement on Athman users or Warsh. Its stated license is **CC BY-NC 4.0**; review the model's terms for the intended deployment. This repository does not distribute its weights.

Whisper Medium is a substantial model. Choose a host with enough memory and, for practical latency, suitable GPU capacity; benchmark the chosen host before offering live recitation. The default Docker image installs CPU PyTorch for compatibility, not a real-time performance promise. A standard lightweight function should proxy to an inference host rather than package the weights. Check the actual host's current [function limits](https://vercel.com/docs/functions/limitations).

## Local operator setup

Use Python 3.12 or the Docker image. Create an isolated environment and install:

```bash
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r server/requirements.txt
```

For GPU deployment, install a PyTorch build compatible with the host's CUDA/driver, or build the Docker image with the appropriate `TORCH_INDEX_URL`. This configuration is a host decision, not performed by the Pages workflow.

Copy `server/.env.example` to the ignored `server/.env`, replace the example signing value with a newly generated long random secret, and set exact permitted origins. Keep the signing secret on the server. Load these environment variables using the host's secret manager or deployment configuration.

Download the pinned checkpoint explicitly, then start one inference worker:

```bash
.venv/bin/python server/download_model.py
.venv/bin/uvicorn asr_app:app --app-dir server --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
```

Set `HF_HOME` to a persistent model cache if the host filesystem is ephemeral. Startup does not silently download a multi-gigabyte checkpoint; inference returns 503 until the model and operator configuration are available.

For Docker, build from the repository root:

```bash
docker build -f server/Dockerfile -t athman-asr .
docker run --rm --env-file server/.env -v athman-models:/models athman-asr python download_model.py
docker run --rm --env-file server/.env -v athman-models:/models -p 127.0.0.1:8000:8000 athman-asr
```

Place the service behind HTTPS and the deployment's normal network controls. A production public service also needs an account/entitlement flow and capacity planning. This implementation supplies expiring tester access tokens, not a customer identity platform.

On the configured host, issue an access token valid for one hour:

```bash
.venv/bin/python server/provision_token.py tester-name
```

Give only that issued token to the tester, never `ASR_SIGNING_SECRET`. The client keeps the token in reader memory and clears it on closing the reader. It does not put it in local storage, logs, URLs, or exports.

## Activate in Athman

1. Open **إعدادات التسميع ← المحرك والميكروفون**.
2. Select **محرك قرآني خارجي — تجريبي**.
3. Enter the deployed HTTPS `/v1/transcribe` URL and the tester's access token.
4. Choose the silence duration and sound threshold, then explicitly consent to sending audio to the chosen host.
5. Press the microphone. The browser captures PCM, resamples to 16 kHz, sends independent WAV segments after the selected silence or at a six-second boundary, and applies returned text through the existing Warsh follower.

Long continuous segments retain a short boundary overlap. The existing text follower handles repeated boundary words. One request runs at a time, at most two clips wait, and backlog stops the session with a message instead of silently dropping audio. Requests are aborted on stop, late replies are ignored, and expired access tokens require deliberate user action. A model confidence is left unknown instead of being invented.

## Serverless gateway (optional)

`gateway/worker.mjs` is a small Cloudflare Worker that forwards the authenticated request to the inference server. It does not run Whisper. Configure `ASR_UPSTREAM` as the full deployed HTTPS transcription endpoint and `ASR_ALLOWED_ORIGIN` as the application's exact origin, then deploy with the operator's Cloudflare tooling. There is no upstream default or automatic external connection. Its public route is `/v1/transcribe`.

Using a gateway does not eliminate the inference server or its costs. The access token is verified by the backend; the gateway forwards it without placing a server master secret in browser code.

## Request contract

`POST /v1/transcribe`, `Content-Type: application/json`, `Authorization: Bearer <short-lived token>`:

```json
{"audio":"base64 PCM16 WAV bytes","sequence":0,"sampleRate":16000}
```

The response contains `sequence`, `text`, `confidence: null`, and model metadata. WAV input must be mono PCM16 at 16 kHz and 0.25–8 seconds. Request bodies, response sizes, per-token request rate, and inference concurrency are bounded. The backend processes audio in memory; it does not write recordings or transcripts to files or access logs.

`GET /health` indicates whether authentication is configured and whether the checkpoint is loaded. It does not certify recognition quality or real-time latency.

## Verification

```bash
python3 -m pip install -r server/requirements-test.txt
python3 -m unittest discover -s server -p 'test_*.py'
node test-asr-client.cjs
node test-asr-gateway.cjs
```

The contract suite injects a known transcriber to test access control, expiry, WAV validation, silence handling, bounded input, and failure responses. The browser integration test uses generated audio and an explicit test response. Neither test establishes Tadabur accuracy on spoken Warsh. No real user recordings or GPU inference benchmark were supplied in this task.
