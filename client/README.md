# ViArena frontend

React/Vite client for https://github.com/IPTtwo/viarena-backend. Accounts and workspace data use the API; browser demo accounts/localStorage are no longer the data source. Existing feature folders and JavaScript/JSX architecture are preserved.

## Local development

Use Node.js 20+ (22 or 24 recommended). Run from this client directory after all integration tickets are merged:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Run the backend separately on port 5000 with its private MONGODB_URI. Frontend defaults to port 5173 and proxies /api to http://127.0.0.1:5000. Example environment: VITE_API_BASE_URL=/api and API_PROXY_TARGET=http://127.0.0.1:5000. Never put database credentials in frontend files or VITE variables.

## Verify

```powershell
npm test
npm run build
npm run format:check
```

Browser tests need the backend repository as a sibling named viarena-backend with its dependencies installed. Alternatively set BACKEND_DIR to its absolute path. Tests start a disposable database and servers on 5001, 5174 and 5175. They do not use Atlas or backend .env.

```powershell
npx playwright install chromium
npm run test:e2e
```

## Production

Build with npm ci --include=dev and npm run build. Set runtime API_PROXY_TARGET to the backend HTTPS origin (without /api), build-time VITE_API_BASE_URL to /api, and run npm start. The included Express server serves dist, handles SPA route refreshes and proxies API requests/cookies. It reads PORT (default 5173) and serves /healthz for process health. Supply runtime environment variables through your host or shell; this server does not load Vite .env automatically. Use HTTPS for production Secure cookies.

TRUST_PROXY_HOPS defaults to zero. Set a bounded value only for a known trusted hosting proxy chain. Cross-site API calls require separate cookie/CSRF configuration.

## Structure and behavior

Routes/guards: src/app; shared controls/navigation: src/components; feature screens: src/features; pure helpers: src/functions; request/normalization: src/services; API state: src/state/StoreProvider.jsx; CSS: src/styles. Preserve this structure when extending the app.

Signup creates Participant and then explicitly logs in. Admin assigns Organizer with an audit reason. No production accounts are seeded. Passwords require 8–128 characters with uppercase, lowercase and a digit. Reset endpoints exist but email delivery is not implemented; development reset links are logged by the backend. Images remain bounded JSON/data URLs; there is no multipart upload service.
