import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = 3001;

// Headers to strip from proxied responses (these block iframe embedding)
const STRIP_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
];

const server = http.createServer((req, res) => {
  // CORS headers for the editor
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Extract target URL from query param: /proxy?url=https://...
  const reqUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (reqUrl.pathname !== '/proxy') {
    res.writeHead(404);
    res.end('Use /proxy?url=<target>');
    return;
  }

  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400);
    res.end('Missing ?url= parameter');
    return;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    res.writeHead(400);
    res.end('Invalid URL');
    return;
  }

  const client = parsedTarget.protocol === 'https:' ? https : http;

  const proxyReq = client.request(parsedTarget.href, {
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedTarget.host,
      referer: parsedTarget.origin,
    },
  }, (proxyRes) => {
    // Copy response headers, stripping iframe-blocking ones
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (STRIP_HEADERS.includes(key.toLowerCase())) continue;
      if (value !== undefined) headers[key] = value as string | string[];
    }

    // Rewrite any location redirects through proxy
    if (headers.location && typeof headers.location === 'string') {
      try {
        const absUrl = new URL(headers.location, targetUrl).href;
        headers.location = `/proxy?url=${encodeURIComponent(absUrl)}`;
      } catch {}
    }

    // Inject base tag so relative URLs resolve to the original domain
    const contentType = String(proxyRes.headers['content-type'] || '');
    const isHtml = contentType.includes('text/html');

    if (isHtml) {
      // Collect body, inject <base> and our console injector
      const chunks: Buffer[] = [];
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf-8');

        // Inject <base href> so relative URLs work
        const baseTag = `<base href="${parsedTarget.origin}${parsedTarget.pathname}">`;
        if (body.includes('<head>')) {
          body = body.replace('<head>', `<head>${baseTag}`);
        } else if (body.includes('<HEAD>')) {
          body = body.replace('<HEAD>', `<HEAD>${baseTag}`);
        } else {
          body = baseTag + body;
        }

        // Remove any CSP meta tags
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

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[TestFlow Proxy] Running on http://localhost:${PORT}`);
  console.log(`[TestFlow Proxy] Usage: http://localhost:${PORT}/proxy?url=https://www.google.com`);
});
