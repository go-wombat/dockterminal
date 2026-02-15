# Vaultdock

Retro CRT-styled Docker management dashboard.

## Features

- **Stack management** — compose-level up/down/restart/stop for managed stacks
- **Container actions** — restart, stop, start, remove individual containers
- **Live stats** — real-time CPU & memory for host and containers (polling)
- **Shell terminal** — real `docker exec` into running containers
- **AI diagnostics** — auto-diagnoses non-running containers from live state
- **CRT theme** — green-on-black terminal aesthetic with scanlines and glow

## Installation

### Docker (recommended)

```bash
docker compose up -d
```

Vaultdock will be available at [http://localhost:5001](http://localhost:5001).

The default `docker-compose.yml` mounts the Docker socket and `/opt/stacks` for managed stacks. To use a different stacks directory on the host:

```yaml
services:
  vaultdock:
    image: vaultdock:latest
    build: .
    container_name: vaultdock
    restart: unless-stopped
    ports:
      - "5001:5001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /path/to/your/stacks:/opt/stacks
    environment:
      - VAULTDOCK_STACKS_DIR=/opt/stacks
```

### Native (Node.js)

**Prerequisites:** Node 18+, Docker running

```bash
npm install
npm run build
npm start
```

Open [http://localhost:5001](http://localhost:5001). Configure the port with `VAULTDOCK_PORT`:

```bash
VAULTDOCK_PORT=3000 npm start
```

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server includes HMR and runs the API as middleware.

## Configuration

### `VAULTDOCK_STACKS_DIR`

Controls where Vaultdock looks for managed stacks. Default: `~/stacks` (native) or `/opt/stacks` (Docker).

```bash
VAULTDOCK_STACKS_DIR=~/my-stacks npm run dev
```

A **managed stack** is a subdirectory inside `STACKS_DIR` containing a compose file (`compose.yaml`, `compose.yml`, or `docker-compose.yml`). Managed stacks get action buttons (up/down/restart/stop) and appear even when not running.

Stacks detected via `docker compose ls` that don't live in `STACKS_DIR` are shown as read-only (unmanaged). Containers not part of any compose project are grouped under "standalone".

## Tech Stack

- React 19 + Vite
- No external UI libraries — all components are custom
- No Docker SDK — shells out to Docker CLI via `execFileSync`
- Express production server (`npm start`) / Vite middleware (`npm run dev`)
