import { StoredRun } from '../storage/db';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Builds a single self-contained HTML file (no external assets) summarizing a
// run's step-by-step results — shareable without the app or IndexedDB access.
export function generateReportHtml(run: StoredRun, testName: string): string {
  const rows = run.results.map(r => {
    const statusColor = r.status === 'passed' ? '#16a34a' : r.status === 'failed' ? '#dc2626' : '#9ca3af';
    return `
      <tr>
        <td style="color:${statusColor};font-weight:600;text-transform:uppercase;font-size:11px;">${r.status}</td>
        <td style="font-family:monospace;font-size:13px;">${escapeHtml(r.type)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;color:#6b7280;">${r.duration}ms</td>
        <td style="color:#dc2626;font-size:12px;">${r.error ? escapeHtml(r.error) : ''}</td>
      </tr>`;
  }).join('');

  const screenshots = (run.screenshots || []).map(s => `
    <figure style="margin:0 0 16px;">
      <img src="${s.data}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;" />
      <figcaption style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(s.label)}</figcaption>
    </figure>`).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>TestKaro Report — ${escapeHtml(testName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { padding: 10px 16px; border-radius: 8px; background: #f3f4f6; font-size: 13px; }
  .stat b { font-size: 18px; display: block; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #9ca3af; padding: 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
</style>
</head>
<body>
  <h1>${escapeHtml(testName)}</h1>
  <div class="meta">${new Date(run.timestamp).toLocaleString()} &middot; ${(run.duration / 1000).toFixed(1)}s</div>
  <div class="summary">
    <div class="stat"><b style="color:#16a34a">${run.passed}</b>Passed</div>
    <div class="stat"><b style="color:#dc2626">${run.failed}</b>Failed</div>
    <div class="stat"><b style="color:#9ca3af">${run.skipped}</b>Skipped</div>
    <div class="stat"><b>${run.total}</b>Total</div>
  </div>
  <table>
    <thead><tr><th>Status</th><th>Step</th><th style="text-align:right">Duration</th><th>Error</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${screenshots ? `<h2 style="font-size:16px;margin-top:32px;">Screenshots</h2>${screenshots}` : ''}
</body>
</html>`;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRunReport(run: StoredRun, testName: string, format: 'html' | 'json') {
  const stamp = new Date(run.timestamp).toISOString().replace(/[:.]/g, '-');
  if (format === 'json') {
    download(`testkaro-report-${stamp}.json`, JSON.stringify(run, null, 2), 'application/json');
  } else {
    download(`testkaro-report-${stamp}.html`, generateReportHtml(run, testName), 'text/html');
  }
}
