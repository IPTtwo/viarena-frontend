# ViArena frontend

React/Vite application for campus events, registration, teams, tasks, schedules, streams and participation. Accounts and workspace data come from the API with HTTP-only cookie sessions. There are no browser demo accounts or localStorage data stores.

## Requirements

- Node.js 22 or 24 LTS and npm (Node.js 20+ supported).
- The [backend repository](https://github.com/IPTtwo/viarena-backend) and MongoDB Atlas or a local replica set.

## Run the backend first

In a separate terminal:

```powershell
cd C:\Users\shean\Documents\GitHub\viarena-backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set the backend's private `MONGODB_URI` to your Atlas URI including the database name, or a local replica set. Use the database user's credentials, percent-encode password special characters, and allow your machine's IP in Atlas Network Access. Set `PORT=5000` and `CLIENT_ORIGIN=http://localhost:5173`, then:

```powershell
npm run dev
```

Keep this terminal running. See the [complete backend guide](https://github.com/IPTtwo/viarena-backend#readme) for environment variables, administrator creation and API contracts. An existing valid backend `.env` should be preserved.

## Run the frontend

In another terminal:

```powershell
cd C:\Users\shean\Documents\GitHub\ViArena\client
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Use your own paths if you cloned elsewhere. The frontend [.env.example](./.env.example) contains:

```env
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://127.0.0.1:5000
```

Open **http://localhost:5173**. The [Vite configuration](./vite.config.js) proxies `/api` to the backend. Use one hostname consistently for cookies. Restart Vite after environment changes. Never put MongoDB credentials or passwords in frontend `VITE_` variables: they are public build values.

Verify:

```powershell
Invoke-RestMethod http://localhost:5173/api/health
Invoke-RestMethod http://localhost:5173/api/workspace
```

Health returns `status: ok`; workspace also checks database access. A new database has no events or demo users. Sign up with a school email. New accounts are Participants; an Admin grants Organizer access with an audit reason. Passwords require 8–128 characters, uppercase, lowercase and a digit. To create the first Admin, follow the backend guide; there are no default production credentials.

## Commands and tests

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite server on port 5173 with API proxy |
| `npm run build` | Production static files in `dist` |
| `npm run preview` | Local preview of the built assets |
| `npm start` | Ordinary Node hosting: serve build and proxy `/api` |
| `npm test` | API client, normalization and domain tests |
| `npm run test:e2e` | Build and run browser integration tests |
| `npm run format:check` | Check source/test formatting |
| `npm run format` | Format source/tests |

Install browser support once:

```powershell
npx playwright install chromium
npm test
npm run test:e2e
```

Install backend dependencies first. Browser tests expect a sibling `viarena-backend`; otherwise set `$env:BACKEND_DIR` to its absolute folder. Tests start disposable MongoDB and servers on `5001`, `5174`, `5175`, without using the backend's `.env` or Atlas. Keep these ports free.

Test signup → login → refresh → profile save → refresh → logout. Browser tests also cover event publishing, registration/cancellation, audited role assignment, connection retry and production proxy cookies.

The production proxy tests exercise the ordinary Node server, not Vercel's hosted routing. Verify the deployed Vercel rewrites with the production checks below after supplying the real backend URL.

## Deploy on Vercel

Use two projects: backend API and frontend. The [backend deployment guide](https://github.com/IPTtwo/viarena-backend#deploy-both-repositories-on-vercel) contains the full Atlas/backend steps.

### 1. Deploy the backend

1. Push the intended backend branch and import that repository in Vercel. Use repository root, Express detection, `npm ci`, and Node.js 22.x or 24.x. Leave Express build/output defaults; there is no frontend `dist` in the API project.
2. Configure backend environment variables: `NODE_ENV=production`, private `MONGODB_URI`, `CLIENT_ORIGIN=https://YOUR_FRONTEND`, `RESET_BASE_URL=https://YOUR_FRONTEND/reset-password`, `COOKIE_NAME=viarena_session`, `SESSION_DAYS=7`, `SCHOOL_EMAIL_DOMAIN=adnu.edu.ph`. Use `TRUST_PROXY_HOPS=1` only for the documented direct Vercel ingress topology.
3. Configure Atlas network access for the backend's deployment network, deploy, and record its stable production URL. Verify its `/api/health` and `/api/workspace` responses.
4. Ensure deployment protection does not return a protection/login page to the intended frontend proxy. Configure preview access/databases separately.

The backend exports Express and reuses database connections within warm functions. Local `npm run dev` is not the Vercel runtime. See [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

### 2. Set the API rewrite destination

In [vercel.json](./vercel.json), replace **both** `https://replace-with-your-backend.vercel.app` occurrences with the actual backend production origin. Keep the `/api` suffix/path. The API rewrites appear before the SPA fallback so API failures remain API responses.

This placeholder must be replaced before deployment. `API_PROXY_TARGET` does not configure Vercel: the local Vite server and the ordinary Node server use it, while Vercel uses the committed rewrite destinations.

### 3. Deploy this repository

Commit/push the intended frontend changes. In Vercel choose **Add New → Project**, import this repository and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `client` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js version | Same as backend |
| Environment variable | `VITE_API_BASE_URL=/api` |

Vercel serves static assets and applies [external rewrites](https://vercel.com/docs/routing/rewrites); it does not run `npm start` or [scripts/serve.mjs](./scripts/serve.mjs). The SPA fallback supports refreshing `/profile` and other application routes, as described in [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite). Environment/build or rewrite changes require redeployment.

### 4. Verify production

1. Align backend `CLIENT_ORIGIN` and `RESET_BASE_URL` with the final frontend URL and redeploy the backend, including when using a custom domain.
2. Check `https://YOUR_FRONTEND/api/health` and `/api/workspace`: both must return JSON. Health alone does not confirm database connectivity.
3. Test signup, login, refresh, saves and logout over HTTPS. Production cookies are Secure and HTTP-only.
4. Refresh `/profile`; check an unknown `/api` route still returns JSON 404.
5. Use a real Admin/Organizer account to publish an event and test Participant registration/cancellation.

The fixed rewrite URL is also used by Preview deployments unless you change their configuration. Use separate preview data and explicit backend destinations/origins before sharing previews.

## Ordinary Node production hosting

```powershell
npm ci
npm run build
$env:API_PROXY_TARGET = 'https://YOUR_BACKEND'
$env:PORT = '5173'
npm start
```

The server proxies API bytes/cookies, serves SPA routes and exposes `/healthz`. Supply runtime variables through the host or shell: it does not load Vite `.env` automatically. Use HTTPS for production browser access. Configure a bounded `TRUST_PROXY_HOPS` only for a verified proxy chain. This mode is separate from static Vercel hosting.

## Code map

| Location | Responsibility |
| --- | --- |
| [src/app/](./src/app/) | Routes and access guards |
| [src/components/](./src/components/) | Shared UI, events and navigation |
| [src/features/](./src/features/) | Participant, Organizer, Admin and auth screens |
| [src/functions/](./src/functions/) | Pure domain, formatting and permission helpers |
| [src/services/](./src/services/) | API requests and workspace normalization |
| [src/state/StoreProvider.jsx](./src/state/StoreProvider.jsx) | Server-backed state, session restoration and async writes |
| [src/data/categories.js](./src/data/categories.js) | Shared event categories |
| [src/styles/](./src/styles/) | Styles and design tokens |

## Troubleshooting and limitations

- Connection error/502: start the backend on 5000 and check the proxy target, without an `/api` suffix.
- Session lost: use a consistent hostname, allow cookies, and use HTTPS in production.
- API returns HTML on Vercel: check the backend domain placeholder, deployment protection and rewrite order.
- MongoDB authentication failed: check the backend database user's password, URI encoding and database permissions. Keep credentials out of frontend configuration and logs.
- Empty events: new databases have no seed content; publish an event as Organizer.
- Port conflict: stop the previous process with Ctrl+C.
- Production reset email delivery is not implemented. Development links are logged by the backend. Streams store external links; there is no multipart image upload service.
