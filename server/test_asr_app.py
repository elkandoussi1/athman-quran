"""Contract/security tests with an injected transcriber, not an ASR accuracy test."""
import base64
import io
import math
import struct
import time
import unittest
import wave
from unittest.mock import patch

from fastapi.testclient import TestClient
from asr_app import Settings, create_app, issue_token, token_signer


def clip(rate=16000, channels=1, seconds=.5, amplitude=.12):
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(b"".join(struct.pack("<h", int(amplitude * 32767 * math.sin(2 * math.pi * 440 * i / rate))) * channels for i in range(int(rate * seconds))))
    return base64.b64encode(output.getvalue()).decode()


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.secret = "public-test-fixture-not-a-real-server-secret"
        self.calls = []
        def transcriber(values, rate):
            self.calls.append((len(values), rate))
            return "الحمد لله رب العالمين"
        self.client = TestClient(create_app(Settings(secret=self.secret), transcriber))
        self.headers = {"Authorization": "Bearer " + issue_token(self.secret), "Origin": "https://elkandoussi1.github.io"}
        self.payload = {"audio": clip(), "sequence": 0, "sampleRate": 16000}

    def test_transcription_contract_has_no_invented_confidence(self):
        response = self.client.post("/v1/transcribe", json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "الحمد لله رب العالمين")
        self.assertIsNone(response.json()["confidence"])
        self.assertEqual(response.json()["sequence"], 0)
        self.assertEqual(self.calls, [(8000, 16000)])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_authentication_origin_and_expiry(self):
        self.assertEqual(self.client.post("/v1/transcribe", json=self.payload).status_code, 401)
        self.assertEqual(self.client.post("/v1/transcribe", json=self.payload, headers={**self.headers, "Origin": "https://other.example"}).status_code, 403)
        self.assertEqual(self.client.post("/v1/transcribe", json=self.payload, headers={**self.headers, "Authorization": "Bearer " + issue_token("different-public-test-fixture-secret")}).status_code, 401)
        with patch("itsdangerous.timed.TimestampSigner.get_timestamp", return_value=int(time.time()) - 7200):
            expired = issue_token(self.secret)
        self.assertEqual(self.client.post("/v1/transcribe", json=self.payload, headers={**self.headers, "Authorization": "Bearer " + expired}).status_code, 401)
        wrong_scope = token_signer(self.secret).dumps({"subject": "test", "audience": "other"})
        self.assertEqual(self.client.post("/v1/transcribe", json=self.payload, headers={**self.headers, "Authorization": "Bearer " + wrong_scope}).status_code, 401)
        self.assertFalse(self.calls)

    def test_wav_format_limits_and_truncation(self):
        for encoded in ["not base64", clip(rate=8000), clip(channels=2), clip(seconds=.1), clip(seconds=8.1), self.payload["audio"][:-12]]:
            with self.subTest(encoded=encoded[:12]):
                self.assertEqual(self.client.post("/v1/transcribe", json={**self.payload, "audio": encoded}, headers=self.headers).status_code, 400)
        self.assertFalse(self.calls)

    def test_request_limits_invalid_json_and_sequence(self):
        self.assertEqual(self.client.post("/v1/transcribe", content=b"x" * 800001, headers=self.headers).status_code, 413)
        self.assertEqual(self.client.post("/v1/transcribe", content=b"{invalid", headers=self.headers).status_code, 400)
        for sequence in [-1, True, "0", 1_000_001]:
            self.assertEqual(self.client.post("/v1/transcribe", json={**self.payload, "sequence": sequence}, headers=self.headers).status_code, 400)

    def test_silence_does_not_invoke_model(self):
        response = self.client.post("/v1/transcribe", json={**self.payload, "audio": clip(amplitude=0)}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "")
        self.assertFalse(self.calls)

    def test_rate_limit_and_missing_operator_setup(self):
        limited = TestClient(create_app(Settings(secret=self.secret, requests_per_minute=1), lambda *_: "text"))
        self.assertEqual(limited.post("/v1/transcribe", json=self.payload, headers=self.headers).status_code, 200)
        self.assertEqual(limited.post("/v1/transcribe", json=self.payload, headers=self.headers).status_code, 429)
        unset = TestClient(create_app(Settings(secret="")))
        self.assertFalse(unset.get("/health").json()["configured"])
        self.assertEqual(unset.post("/v1/transcribe", json=self.payload).status_code, 503)

    def test_failed_model_never_returns_a_fake_reference(self):
        def broken(*_):
            raise RuntimeError("must not echo request contents")
        client = TestClient(create_app(Settings(secret=self.secret), broken))
        response = client.post("/v1/transcribe", json=self.payload, headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("text", response.json())
        self.assertNotIn("must not echo", response.text)


if __name__ == "__main__":
    unittest.main()
