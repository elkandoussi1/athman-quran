"""Explicit operator command: download the pinned checkpoint; no API key needed."""
from huggingface_hub import snapshot_download
from asr_app import MODEL_ID, MODEL_REVISION

if __name__ == "__main__":
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, allow_patterns=[
        "model.safetensors", "config.json", "generation_config.json", "preprocessor_config.json",
        "processor_config.json", "tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt",
        "special_tokens_map.json", "added_tokens.json", "normalizer.json",
    ])
