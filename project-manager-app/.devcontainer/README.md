# SEMSE OS Dev Container

## Prerrequisito Windows

Docker Desktop debe estar instalado y en ejecución. Instalación interactiva:

```powershell
winget install --id Docker.DockerDesktop --exact
```

Después de instalar, reinicia Windows si el instalador o WSL lo solicita y
comprueba `docker version` antes de reabrir el proyecto.

Abre la raíz canónica en VS Code y ejecuta **Dev Containers: Reopen in
Container**. El entorno incluye Node 22, pnpm 10.33, Docker CLI y GitHub CLI;
levanta PostgreSQL 16, Redis 7, MinIO y MailHog mediante Compose.

Desde el workspace se accede a esos servicios por sus nombres de red
(`postgres:5432`, `redis:6379`, `minio:9000`). Sus puertos publicados permiten
usar herramientas del host; `forwardPorts` se reserva para Web y API ejecutados
dentro del contenedor de desarrollo.

Ollama es opcional para evitar descargar modelos o reservar memoria sin
intención explícita:

```bash
docker compose \
  -f infra/docker/compose.semse-mvp.yml \
  -f .devcontainer/docker-compose.devcontainer.yml \
  --profile local-ai up -d ollama
```

La imagen local está fijada a `ollama/ollama:0.32.1`. Su actualización exige
verificar el tag oficial, reconstruir el Dev Container y repetir el smoke local.

Reglas:

- El Dev Container es desarrollo local, no configuración de Railway.
- Los valores incluidos son credenciales locales desechables.
- No copiar `.env` o secretos de producción al contenedor.
- `postCreateCommand` instala exactamente el lockfile del monorepo.
- Bun y Railway CLI no se instalan globalmente por defecto; se añadirán solo si
  un spec demuestra que son necesarios para el flujo canónico.

## Referencias oficiales

- Docker Compose, múltiples archivos y resolución de paths:
  https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/
- Dev Containers con Docker Compose:
  https://containers.dev/guide/dockerfile
- Docker Desktop para Windows y WSL 2:
  https://docs.docker.com/desktop/setup/install/windows-install/
- Profiles de Compose:
  https://docs.docker.com/compose/how-tos/profiles/
