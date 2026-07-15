import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { PlaywrightExecutor, ExecutionConfig, TestStep } from './playwright-executor.js';
import { MobileExecutor, MobileExecutionConfig, MobileTestStep } from './mobile-executor.js';
import { listDevices, runDoctorChecks, installAppiumDriver, bootIosSimulator } from './mobile-devices.js';
import { startRecording, stopRecording, setRecordingMode, toggleDomOverlay, RecordingSession } from './recorder.js';

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

type AnyExecutor = PlaywrightExecutor | MobileExecutor;

wss.on('connection', (ws: WebSocket) => {
  console.log('[TestKaro] WebSocket client connected');
  let executor: AnyExecutor | null = null;
  let recordingSession: RecordingSession | null = null;

  ws.on('message', async (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); }
    catch { ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } })); return; }

    const send = (event: any) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
    };

    try {
    switch (msg.type) {
      case 'run': {
        // A second 'run' on the same socket must not orphan a live browser/device session
        if (executor) {
          executor.abort();
          await executor.close().catch(() => {});
          executor = null;
        }

        if (msg.engine === 'mobile') {
          const steps: MobileTestStep[] = msg.steps || [];
          const mobileConfig: MobileExecutionConfig = {
            platform: msg.mobileConfig?.platform === 'ios' ? 'ios' : 'android',
            deviceId: msg.mobileConfig?.deviceId || undefined,
            appPath: msg.mobileConfig?.appPath || undefined,
            appPackage: msg.mobileConfig?.appPackage || undefined,
            appActivity: msg.mobileConfig?.appActivity || undefined,
            bundleId: msg.mobileConfig?.bundleId || undefined,
            screenshotOnFailure: msg.screenshotOnFailure !== false,
          };

          const mobileExecutor = new MobileExecutor(send, mobileConfig);
          executor = mobileExecutor;
          if (msg.breakpoints && Array.isArray(msg.breakpoints)) {
            mobileExecutor.breakpoints = new Set(msg.breakpoints);
          }

          try {
            await mobileExecutor.launch();
            await mobileExecutor.run(steps);
          } catch (err: any) {
            send({ type: 'error', data: { message: err.message || String(err) } });
            await mobileExecutor.close().catch(() => {});
          }
          executor = null;
          break;
        }

        const steps: TestStep[] = msg.steps || [];
        const config: ExecutionConfig = {
          headed: msg.headed !== false,
          browserType: ['chromium', 'firefox', 'webkit'].includes(msg.browserType) ? msg.browserType : undefined,
          slowMo: msg.slowMo || 30,
          viewport: msg.viewport || { width: 1280, height: 720 },
          recordVideo: msg.recordVideo || false,
          screenshotOnFailure: msg.screenshotOnFailure !== false,
          videoDir: msg.videoDir || undefined,
        };

        const webExecutor = new PlaywrightExecutor(send, config);
        executor = webExecutor;
        if (msg.breakpoints && Array.isArray(msg.breakpoints)) {
          webExecutor.breakpoints = new Set(msg.breakpoints);
        }

        try {
          await webExecutor.launch();
          await webExecutor.run(steps);
          // In headed mode, executor stays alive until 'stop' is sent
          if (!config.headed) {
            executor = null;
          }
        } catch (err: any) {
          send({ type: 'error', data: { message: err.message || String(err) } });
          await webExecutor.close();
          executor = null;
        }
        break;
      }

      case 'list-devices': {
        const devices = await listDevices();
        send({ type: 'devices', data: { devices } });
        break;
      }

      case 'boot-device': {
        try {
          await bootIosSimulator(String(msg.deviceId || ''));
          send({ type: 'device-booted', data: { deviceId: msg.deviceId } });
        } catch (err: any) {
          send({ type: 'error', data: { message: err.message || String(err) } });
        }
        break;
      }

      case 'doctor': {
        const checks = await runDoctorChecks();
        send({ type: 'doctor-result', data: { checks } });
        break;
      }

      case 'install-driver': {
        const driver = msg.driver === 'xcuitest' ? 'xcuitest' : 'uiautomator2';
        const result = await installAppiumDriver(driver);
        send({ type: 'driver-install-result', data: { driver, ...result } });
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
          recordingSession = await startRecording(url, headed, (event) => {
            send(event);
            // If browser closed/disconnected, null out the session
            if (event.type === 'record-done') {
              recordingSession = null;
            }
          });
        } catch (err: any) {
          send({ type: 'error', data: { message: err.message } });
        }
        break;
      }

      case 'record-stop': {
        if (recordingSession) {
          const session = recordingSession;
          recordingSession = null;
          await stopRecording(session);
          send({ type: 'record-done', data: {} });
        }
        break;
      }

      case 'record-mode': {
        if (recordingSession && msg.mode) {
          await setRecordingMode(recordingSession, msg.mode);
          send({ type: 'record-mode-changed', data: { mode: msg.mode } });
        }
        break;
      }

      case 'overlay-toggle': {
        if (recordingSession) {
          await toggleDomOverlay(recordingSession);
          send({ type: 'overlay-toggled', data: {} });
        }
        break;
      }

      default:
        send({ type: 'error', data: { message: `Unknown message type: ${msg.type}` } });
    }
    } catch (err: any) {
      send({ type: 'error', data: { message: err?.message || String(err) } });
    }
  });

  ws.on('close', async () => {
    console.log('[TestKaro] WebSocket client disconnected');
    if (executor) { executor.abort(); await executor.close(); }
    if (recordingSession) { await stopRecording(recordingSession); }
  });
});

// ─── START ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[TestKaro Server] Running on http://localhost:${PORT}`);
  console.log(`[TestKaro Server] Proxy: http://localhost:${PORT}/proxy?url=<target>`);
  console.log(`[TestKaro Server] WebSocket: ws://localhost:${PORT}/ws`);
});
