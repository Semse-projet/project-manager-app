#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
HOST="${OLLAMA_HOST:-0.0.0.0:11434}"

echo "[ollama-start] Iniciando servidor Ollama en ${HOST}"
echo "[ollama-start] Modelo objetivo: ${MODEL}"

# Start Ollama server in background
OLLAMA_HOST="${HOST}" ollama serve &
SERVER_PID=$!

# Wait for server to be ready (up to 60s)
echo "[ollama-start] Esperando servidor..."
ATTEMPTS=0
until curl -sf "http://localhost:11434/api/tags" > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $ATTEMPTS -ge 30 ]; then
    echo "[ollama-start] ERROR: Servidor no respondió después de 60s"
    exit 1
  fi
  sleep 2
done
echo "[ollama-start] Servidor listo."

# Pull model only if not already present (uses /root/.ollama volume)
if ollama list | grep -q "^${MODEL}"; then
  echo "[ollama-start] Modelo ${MODEL} ya disponible."
else
  echo "[ollama-start] Descargando modelo ${MODEL}..."
  ollama pull "${MODEL}"
  echo "[ollama-start] Modelo ${MODEL} descargado."
fi

# Warm-up: run a quick inference to load model into RAM
echo "[ollama-start] Calentando modelo..."
ollama run "${MODEL}" "OK" > /dev/null 2>&1 || true
echo "[ollama-start] Modelo listo. Sirviendo en ${HOST}"

# Keep server running
wait $SERVER_PID
