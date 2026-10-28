FROM python:3.12-slim
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/models
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir "torch>=2.7,<3" --index-url "$TORCH_INDEX_URL" && pip install --no-cache-dir -r requirements.txt
COPY server/ ./
RUN useradd -m -u 10001 asr && mkdir -p /models && chown asr:asr /models
USER asr
EXPOSE 8000
CMD ["uvicorn", "asr_app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
