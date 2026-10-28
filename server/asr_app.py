"""Optional authenticated Quran ASR. Audio/text stay in request memory.

This service is deployed separately from GitHub Pages. Tests inject a transcriber;
model inference is never replaced by reference text or a mock in production.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import io
import json
import math
import os
import time
import wave
from array import array
from collections import OrderedDict, deque
from dataclasses import dataclass
from typing import Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.concurrency import run_in_threadpool

MODEL_ID = "rakansuliman/tadabur-whisper-medium"
MODEL_REVISION = "e82c2d827ad0df27e31042f7fb87c73df1da2c8b"
MAX_BODY = 800_000


@dataclass(frozen=True)
class Settings:
    secret: str = ""
    origins: tuple[str, ...] = ("https://elkandoussi1.github.io",)
    requests_per_minute: int = 60

    @classmethod
    def from_environment(cls):
        return cls(
            secret=os.environ.get("ASR_SIGNING_SECRET", ""),
            origins=tuple(value.strip() for value in os.environ.get(
                "ASR_ALLOWED_ORIGINS", "https://elkandoussi1.github.io"
            ).split(",") if value.strip()),
        )


def token_signer(secret: str):
    return URLSafeTimedSerializer(secret, salt="athman-asr-session-v1")


def issue_token(secret: str, subject: str = "operator") -> str:
    if len(secret) < 32:
        raise ValueError("A server signing secret of at least 32 characters is required")
    return token_signer(secret).dumps({"subject": subject[:80], "audience": "athman-asr"})


def decode_audio(encoded: str) -> tuple[array, int]:
    try:
        raw = base64.b64decode(encoded, validate=True)
        with wave.open(io.BytesIO(raw), "rb") as reader:
            if (reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getcomptype()) != (1, 2, 16000, "NONE"):
                raise ValueError("Unsupported audio format")
            frames = reader.getnframes()
            if not 4000 <= frames <= 128_000:
                raise ValueError("Audio must be between 0.25 and 8 seconds")
            pcm = reader.readframes(frames)
            if len(pcm) != frames * 2:
                raise ValueError("Truncated audio")
        values = array("h")
        values.frombytes(pcm)
        import sys
        if sys.byteorder != "little":
            values.byteswap()
        return values, 16000
    except (ValueError, EOFError, wave.Error, binascii.Error, TypeError):
        raise HTTPException(400, "Expected a 16 kHz mono PCM16 WAV segment, 0.25–8 seconds") from None


class WhisperTranscriber:
    def __init__(self):
        # Heavy dependencies are imported only on a real authenticated request.
        # trust_remote_code is deliberately disabled; the architecture is standard Whisper.
        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = WhisperProcessor.from_pretrained(
            MODEL_ID, revision=MODEL_REVISION, local_files_only=True, trust_remote_code=False
        )
        self.model = WhisperForConditionalGeneration.from_pretrained(
            MODEL_ID, revision=MODEL_REVISION, local_files_only=True, trust_remote_code=False
        ).to(self.device).eval()

    def __call__(self, values: array, sample_rate: int) -> str:
        import numpy as np
        samples = np.asarray(values, dtype=np.float32) / 32768.0
        inputs = self.processor(samples, sampling_rate=sample_rate, return_tensors="pt", return_attention_mask=True)
        with self.torch.inference_mode():
            tokens = self.model.generate(
                inputs.input_features.to(self.device),
                attention_mask=inputs.attention_mask.to(self.device),
                language="ar", task="transcribe", max_new_tokens=128, do_sample=False,
            )
        return self.processor.batch_decode(tokens, skip_special_tokens=True)[0].strip()


def create_app(settings: Settings | None = None, transcriber: Callable | None = None):
    settings = settings or Settings.from_environment()
    app = FastAPI(title="Athman optional Quran ASR", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.origins), allow_methods=["POST", "GET"],
                       allow_headers=["Content-Type", "Authorization"], allow_credentials=False)
    engine = {"value": transcriber}
    busy = asyncio.Lock()
    buckets: OrderedDict[str, deque] = OrderedDict()

    @app.middleware("http")
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health")
    async def health():
        return {"service": "athman-asr", "configured": len(settings.secret) >= 32,
                "modelLoaded": engine["value"] is not None, "model": MODEL_ID,
                "revision": MODEL_REVISION, "riwaya": "Hafs-trained; Warsh untested", "storesAudio": False}

    @app.post("/v1/transcribe")
    async def transcribe(request: Request):
        if len(settings.secret) < 32:
            raise HTTPException(503, "Service authentication has not been configured")
        origin = request.headers.get("origin")
        if origin and origin not in settings.origins:
            raise HTTPException(403, "Origin is not allowed")
        authorization = request.headers.get("authorization", "")
        if not authorization.startswith("Bearer ") or len(authorization) > 2200:
            raise HTTPException(401, "A short-lived access token is required")
        try:
            identity = token_signer(settings.secret).loads(authorization[7:], max_age=3600)
            if not isinstance(identity, dict) or identity.get("audience") != "athman-asr" or not isinstance(identity.get("subject"), str):
                raise BadSignature("Invalid scope")
        except (BadSignature, SignatureExpired):
            raise HTTPException(401, "Access token is invalid or expired") from None
        now = time.monotonic()
        subject = identity["subject"][:80]
        bucket = buckets.setdefault(subject, deque())
        buckets.move_to_end(subject)
        while bucket and now - bucket[0] >= 60:
            bucket.popleft()
        if len(bucket) >= settings.requests_per_minute:
            raise HTTPException(429, "Request limit reached", headers={"Retry-After": "10"})
        bucket.append(now)
        while len(buckets) > 4096:
            buckets.popitem(last=False)
        chunks = bytearray()
        async for chunk in request.stream():
            chunks.extend(chunk)
            if len(chunks) > MAX_BODY:
                raise HTTPException(413, "Audio request is too large")
        try:
            data = json.loads(chunks)
            if not isinstance(data, dict) or not isinstance(data.get("audio"), str) or type(data.get("sequence")) is not int or not 0 <= data["sequence"] <= 1_000_000 or data.get("sampleRate") != 16000:
                raise ValueError()
        except (ValueError, TypeError, UnicodeDecodeError):
            raise HTTPException(400, "Invalid audio request") from None
        values, rate = decode_audio(data["audio"])
        if math.sqrt(sum(value * value for value in values) / len(values)) / 32768 < .003:
            return {"sequence": data["sequence"], "text": "", "confidence": None, "model": MODEL_ID}
        if busy.locked():
            raise HTTPException(429, "The inference worker is busy", headers={"Retry-After": "2"})
        async with busy:
            try:
                if engine["value"] is None:
                    engine["value"] = await run_in_threadpool(WhisperTranscriber)
                text = await run_in_threadpool(engine["value"], values, rate)
            except Exception:
                # Do not echo exception strings containing request data or host paths.
                return JSONResponse({"detail": "Model is unavailable; operator setup is required"}, status_code=503)
        if not isinstance(text, str) or len(text) > 5000:
            raise HTTPException(502, "Invalid inference result")
        # Whisper does not supply a calibrated browser-style confidence.
        return {"sequence": data["sequence"], "text": text, "confidence": None,
                "model": MODEL_ID, "revision": MODEL_REVISION, "riwaya": "Hafs-trained; Warsh untested"}

    return app


app = create_app()
