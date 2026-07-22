# OSWorld Web

A collection of self-hosted web applications orchestrated with Docker Compose and routed through a Caddy reverse proxy. Each app runs as an isolated container on port 3000 and is accessible via its own domain (e.g. `careerlink.localhost`). The domain suffix is configurable via the `HOST_SUFFIX` environment variable.

## Architecture

```
Client
  │
  ▼
Caddy (reverse proxy, ports 80/443)
  │
  ├── careerlink.localhost   → careerlink_web:3000
  ├── mailhub.localhost      → mailhub_web_frontend:80
  ├── streamview.localhost   → streamview_web_frontend:80
  └── ... (one entry per app)
```

- **Reverse Proxy**: [Caddy Docker Proxy](https://github.com/lucaslorentz/caddy-docker-proxy) auto-configures routes from Docker labels.
- **Apps**: Each submodule is an independent web app with its own `web-compose.yml`.
- **Networking**: All services share a `web` Docker network.

## Included Applications

The `basesite` submodule is kept as a reference/template and is intentionally excluded from the generated `docker-compose.yml`.

| Site | Submodule | Description |
|------|-----------|-------------|
| awsconsole | `awsconsole_web` | AWS console |
| budgetwise | `budgetwise_web` | Budget management |
| calendar | `calendar_web` | Calendar |
| careerlink | `careerlink_web` | Career/job platform |
| cloudcrm | `cloudcrm_web` | Cloud CRM |
| dinogame | `dinogame_web` | Dino game |
| eventix | `eventix_web` | Event management |
| expenseflow | `expenseflow_web` | Expense tracking |
| formcraft | `formcraft_web` | Form builder |
| glbviewer | `glbviewer_web` | GLB model viewer |
| mailhub | `mailhub_web` | Email/messaging hub |
| overleaf | `overleaf_web` | Hosted Overleaf editor |
| overleaf-collab | `overleaf_collab_web` | Cookie-scoped collaborative LaTeX task with persistent live state |
| reviewsphere | `reviewsphere_web` | Review management |
| slidepuzzle | `slidepuzzle_web` | Slide puzzle |
| streamview, studio.streamview | `streamview_web` | Video streaming and creator studio |
| teamchat | `teamchat_web` | Team communication |
| travelhubpro | `travelhub_ad_web` | Travel booking |
| vaultbank | `vaultbank_web` | Banking application |
| visaapplication | `visaapplication_web` | Visa application |
| wandb | `wandb_web` | Experiment tracking |

## Prerequisites

### Docker

Install [Docker Engine](https://docs.docker.com/engine/install/) along with the Compose plugin. Verify with:

```bash
docker compose version
```

### SSH Key for Submodules

Submodules use SSH URLs (`git@github.com:Task-Web/...`). Make sure your SSH key is configured for GitHub:

```bash
ssh -T git@github.com
```

## Quick Start

```bash
# Clone with all submodules
git clone --recurse-submodules git@github.com:Task-Web/OSWorld-web.git
cd OSWorld-web

# Start all services
docker compose up -d
```

Each app will be available at `http://<appname>.${HOST_SUFFIX}` by default (`HOST_SUFFIX=localhost`, `CADDY_SCHEME=http://`).

### Wildcard DNS with nip.io

If you do not have a domain name, you can use a wildcard DNS service like [nip.io](https://nip.io/) and point the hostname at either a public IP or a private IP:

```bash
# Public IP example
HOST_SUFFIX=13.234.12.3.nip.io docker compose up -d

# Private IP example
HOST_SUFFIX=10.0.0.25.nip.io docker compose up -d
```

This gives you addresses like `http://mailhub.13.234.12.3.nip.io` or `http://mailhub.10.0.0.25.nip.io`.

`nip.io` can map both public and private IPs, but its documentation notes that some DNS resolvers, forwarders, and routers block private-address lookups because of DNS rebinding protection. If that happens on your network, use local DNS or `hosts` entries instead.

### Custom Domain Suffix

If you have your own domain, you can point a wildcard DNS record (`*.example.com`) at your server's IP address and set `HOST_SUFFIX=example.com` to access apps at `http://<appname>.example.com`.

Set the `HOST_SUFFIX` environment variable to use a custom domain suffix. The default scheme is HTTP, but you can set `CADDY_SCHEME` to `https://` if you have your own domain and want HTTPS:

```bash
# Use a custom domain
HOST_SUFFIX=example.com CADDY_SCHEME=https:// docker compose up -d

# Or export it
export HOST_SUFFIX=example.com
export CADDY_SCHEME=https://
docker compose up -d
```

Apps will then be reachable at `https://<appname>.example.com`.

## Managing the Compose File

The `docker-compose.yml` is generated from `docker-compose.main.yml` (Caddy base) plus each runtime app's `web-compose.yml`. The generator intentionally skips `basesite/web-compose.yml`.

```bash
# Regenerate after adding/removing submodules
bash gen-compose.sh
```
