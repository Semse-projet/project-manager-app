#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
HOST="${OLLAMA_HOST:-0.0.0.0:11434}"
# Extra models pulled alongside MODEL, comma-separated (e.g. "glm4,llama3.2:1b").
# Only MODEL gets warmed up; EXTRA_MODELS just get pulled so they're ready on demand.
EXTRA_MODELS="${OLLAMA_EXTRA_MODELS:-}"

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

# Pull any extra models (no warm-up — loaded into RAM on first request)
if [ -n "${EXTRA_MODELS}" ]; then
  IFS=',' read -ra MODELS_TO_PULL <<< "${EXTRA_MODELS}"
  for extra in "${MODELS_TO_PULL[@]}"; do
    extra="$(echo "${extra}" | xargs)" # trim whitespace
    [ -z "${extra}" ] && continue
    if ollama list | grep -q "^${extra}"; then
      echo "[ollama-start] Modelo extra ${extra} ya disponible."
    else
      echo "[ollama-start] Descargando modelo extra ${extra}..."
      ollama pull "${extra}"
      echo "[ollama-start] Modelo extra ${extra} descargado."
    fi
  done
fi

# Warm-up: run a quick inference to load the primary model into RAM
echo "[ollama-start] Calentando modelo..."
ollama run "${MODEL}" "OK" > /dev/null 2>&1 || true
echo "[ollama-start] Modelo listo. Sirviendo en ${HOST}"

# Keep server running
wait $SERVER_PID
