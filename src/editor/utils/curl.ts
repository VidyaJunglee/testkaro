import { NetworkEntry } from '../engine';

/**
 * Generate a cURL command string from a network entry.
 */
export function generateCurl(entry: NetworkEntry): string {
  const parts: string[] = ['curl'];

  // Method
  if (entry.method && entry.method !== 'GET') {
    parts.push(`-X ${entry.method}`);
  }

  // URL
  parts.push(`'${entry.url}'`);

  // Request headers
  if (entry.requestHeaders) {
    for (const [key, value] of Object.entries(entry.requestHeaders)) {
      // Skip pseudo-headers and host (curl adds these)
      if (key.startsWith(':') || key === 'host') continue;
      parts.push(`-H '${key}: ${value}'`);
    }
  }

  // Body
  if (entry.postData) {
    // Escape single quotes in body
    const escaped = entry.postData.replace(/'/g, "'\\''");
    parts.push(`-d '${escaped}'`);
  }

  return parts.join(' \\\n  ');
}

/**
 * Copy text to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
