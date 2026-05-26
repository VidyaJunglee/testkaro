import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { PlaywrightExecutor, ExecutionConfig, TestStep } from './playwright-executor.js';
import { startRecording, stopRecording } from './recorder.js';

const PORT = 3001;

// Headers to strip from proxied responses
const STRIP_HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only'];

// ─── HTTP SERVER (Proxy) ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const reqUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '3.0.0' }));
    return;
  }

  if (reqUrl.pathname !== '/proxy') {
    res.writeHead(404);
    res.end('Use /proxy?url=<target>');
    return;
  }

  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) { res.writeHead(400); res.end('Missing ?url= parameter'); return; }

  let parsedTarget: URL;
  try { parsedTarget = new URL(targetUrl); }
  catch { res.writeHead(400); res.end('Invalid URL'); return; }

  const client = parsedTarget.protocol === 'https:' ? https : http;

  const proxyReq = client.request(parsedTarget.href, {
    method: req.method,
    headers: { ...req.headers, host: parsedTarget.host, referer: parsedTarget.origin },
  }, (proxyRes) => {
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (STRIP_HEADERS.includes(key.toLowerCase())) continue;
      if (value !== undefined) headers[key] = value as string | string[];
    }

    if (headers.location && typeof headers.location === 'string') {
      try {
        const absUrl = new URL(headers.location, targetUrl).href;
        headers.location = `/proxy?url=${encodeURIComponent(absUrl)}`;
      } catch {}
    }

    const contentType = String(proxyRes.headers['content-type'] || '');
    const isHtml = contentType.includes('text/html');

    if (isHtml) {
      const chunks: Buffer[] = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf-8');
        const baseTag = `<base href="${parsedTarget.origin}${parsedTarget.pathname}">`;
        if (body.includes('<head>')) body = body.replace('<head>', `<head>${baseTag}`);
        else if (body.includes('<HEAD>')) body = body.replace('<HEAD>', `<HEAD>${baseTag}`);
        else body = baseTag + body;
        body = body.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
        delete headers['content-length'];
        delete headers['content-encoding'];
        delete headers['transfer-encoding'];
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
      });
    } else {
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => { res.writeHead(502); res.end(`Proxy error: ${err.message}`); });
  req.pipe(proxyReq);
});

// ─── WEBSOCKET SERVER ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[TestFlow] WebSocket client connected');
  let executor: PlaywrightExecutor | null = null;
  let recordingSession: any = null;

  ws.on('message', async (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); }
    catch { ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } })); return; }

    const send = (event: any) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
    };

    switch (msg.type) {
      case 'run': {
        const steps: TestStep[] = msg.steps || [];
        const config: ExecutionConfig = {
          headed: msg.headed !== false,
          slowMo: msg.slowMo || 50,
          viewport: msg.viewport || { width: 1280, height: 720 },
          recordVideo: msg.recordVideo || false,
        };

        executor = new PlaywrightExecutor(send, config);
        if (msg.breakpoints && Array.isArray(msg.breakpoints)) {
          executor.breakpoints = new Set(msg.breakpoints);
        }

        try {
          await executor.launch();
          await executor.executeSteps(steps);
        } catch (err: any) {
          send({ type: 'error', data: { message: err.message || String(err) } });
          await executor.close();
        }
        executor = null;
        break;
      }

      case 'stop': {
        if (executor) {
          executor.abort();
          await executor.close();
          executor = null;
          send({ type: 'done', data: { results: [], aborted: true } });
        }
        break;
      }

      case 'pause': {
        if (executor) {
          executor.pause();
          send({ type: 'paused', data: {} });
        }
        break;
      }

      case 'resume': {
        if (executor) {
          executor.resume();
          send({ type: 'resumed', data: {} });
        }
        break;
      }

      case 'record-start': {
        const url = String(msg.url || '');
        const headed = msg.headed !== false;
        try {
          recordingSession = await startRecording(url, headed, send);
        } catch (err: any) {
          send({ type: 'error', data: { message: err.message } });
        }
        break;
      }

      case 'record-stop': {
        if (recordingSession) {
          await stopRecording(recordingSession);
          recordingSession = null;
          send({ type: 'record-done', data: {} });
        }
        break;
      }

      default:
        send({ type: 'error', data: { message: `Unknown message type: ${msg.type}` } });
    }
  });

  ws.on('close', async () => {
    console.log('[TestFlow] WebSocket client disconnected');
    if (executor) { executor.abort(); await executor.close(); }
    if (recordingSession) { await stopRecording(recordingSession); }
  });
});

// ─── START ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[TestFlow Server] Running on http://localhost:${PORT}`);
  console.log(`[TestFlow Server] Proxy: http://localhost:${PORT}/proxy?url=<target>`);
  console.log(`[TestFlow Server] WebSocket: ws://localhost:${PORT}/ws`);
});
