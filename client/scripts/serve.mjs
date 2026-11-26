import express from 'express';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const app = express();
const target = new URL(process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000');
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
  throw new Error('API_PROXY_TARGET must be an HTTP(S) origin without credentials.');
if (target.pathname !== '/' || target.search || target.hash)
  throw new Error('API_PROXY_TARGET must contain only the API origin, without /api.');
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
  throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
app.set('trust proxy', proxyHops);
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Keep browser sessions on the frontend origin when repositories deploy separately.
// No body parser here: forward request bytes, methods, cookies and status unchanged.
app.use('/api', (req, res) => {
  const headers = { ...req.headers, host: target.host };
  for (const name of [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ])
    delete headers[name];
  headers['x-forwarded-for'] = req.ip;
  headers['x-forwarded-proto'] = req.protocol;
  headers['x-forwarded-host'] = req.get('host');
  const transport = target.protocol === 'https:' ? https : http;
  const upstream = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path: req.originalUrl,
      headers,
    },
    (response) => {
      const responseHeaders = { ...response.headers };
      delete responseHeaders.connection;
      delete responseHeaders['transfer-encoding'];
      res.writeHead(response.statusCode, responseHeaders);
      response.on('error', () => res.destroy());
      response.pipe(res);
    },
  );
  upstream.setTimeout(30000, () => upstream.destroy(new Error('API timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'Backend unavailable' });
    else res.destroy();
  });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
});
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.use(express.static(dist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/assets/')) return res.sendStatus(404);
  res.sendFile('index.html', { root: dist });
});
const port = Number(process.env.PORT) || 5173;
app.listen(port, '0.0.0.0', () => console.log(`ViArena frontend listening on port ${port}`));
