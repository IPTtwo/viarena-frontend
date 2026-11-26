# ViArena

Campus event discovery, registration, team management, schedules, streams and verified participation. This repository contains the React/Vite frontend in [client/](./client/); the [Express/MongoDB backend](https://github.com/IPTtwo/viarena-backend) lives separately.

Read the [frontend setup and Vercel guide](./client/README.md) for installation, environment variables, commands, tests and deployment. The [backend guide](https://github.com/IPTtwo/viarena-backend#readme) covers MongoDB, API setup, the first administrator, API contracts and deployment of both projects.

## Quick start

Use Node.js 22 or 24 LTS and install/start the backend separately on port 5000. From this repository:

```powershell
cd client
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Open **http://localhost:5173**. Frontend settings are `VITE_API_BASE_URL=/api` and `API_PROXY_TARGET=http://127.0.0.1:5000`. MongoDB credentials belong only in the backend environment.

For Vercel, deploy the backend first, replace the backend placeholder in [client/vercel.json](./client/vercel.json), and import this repository with Root Directory **client**, preset **Vite**, and output **dist**. Follow the full guide before deploying.
