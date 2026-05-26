import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface RecordingSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

type EventSender = (event: any) => void;

/**
 * Generates multiple selector suggestions for an element.
 * Priority: data-testid > aria-label > id > role > CSS path
 */
function getSelectorGeneratorScript(): string {
  return `
    window.__testflowRecorder = {
      getSelectors(el) {
        const selectors = [];

        // data-testid
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy');
        if (testId) selectors.push({ type: 'testid', value: '[data-testid="' + testId + '"]', confidence: 1.0 });

        // aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) selectors.push({ type: 'aria', value: 'text=' + ariaLabel, confidence: 0.9 });

        // id
        if (el.id) selectors.push({ type: 'id', value: '#' + CSS.escape(el.id), confidence: 0.95 });

        // role + name
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30);
        if (role && name) selectors.push({ type: 'role', value: 'role=' + role + '[name="' + name + '"]', confidence: 0.7 });

        // placeholder
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) selectors.push({ type: 'placeholder', value: '[placeholder="' + placeholder + '"]', confidence: 0.8 });

        // text content (for buttons/links)
        if (['A', 'BUTTON', 'LABEL'].includes(el.tagName)) {
          const text = el.textContent?.trim();
          if (text && text.length < 50) selectors.push({ type: 'text', value: 'text="' + text + '"', confidence: 0.75 });
        }

        // CSS path (fallback)
        const cssPath = getCssPath(el);
        if (cssPath) selectors.push({ type: 'css', value: cssPath, confidence: 0.5 });

        return selectors.length > 0 ? selectors : [{ type: 'css', value: getCssPath(el) || el.tagName.toLowerCase(), confidence: 0.3 }];
      }
    };

    function getCssPath(el) {
      const parts = [];
      let current = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = '#' + CSS.escape(current.id);
          parts.unshift(selector);
          break;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }
        parts.unshift(selector);
        current = parent;
      }
      return parts.join(' > ');
    }
  `;
}

function getRecorderInjectionScript(): string {
  return `
    ${getSelectorGeneratorScript()}

    (function() {
      let lastInputEl = null;
      let inputTimer = null;

      function sendAction(action) {
        window.__testflowSendAction(JSON.stringify(action));
      }

      // Click listener
      document.addEventListener('click', (e) => {
        const el = e.target;
        if (!el || el === document.body) return;
        const selectors = window.__testflowRecorder.getSelectors(el);
        sendAction({ type: 'click', selectors, tagName: el.tagName, text: el.textContent?.trim()?.slice(0, 50) });
      }, true);

      // Input listener (debounced)
      document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el || !('value' in el)) return;
        lastInputEl = el;
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => {
          if (lastInputEl) {
            const selectors = window.__testflowRecorder.getSelectors(lastInputEl);
            sendAction({ type: 'fill', selectors, value: lastInputEl.value });
            lastInputEl = null;
          }
        }, 500);
      }, true);

      // Select change
      document.addEventListener('change', (e) => {
        const el = e.target;
        if (el && el.tagName === 'SELECT') {
          const selectors = window.__testflowRecorder.getSelectors(el);
          sendAction({ type: 'select', selectors, value: el.value });
        }
        if (el && el.type === 'checkbox') {
          const selectors = window.__testflowRecorder.getSelectors(el);
          sendAction({ type: el.checked ? 'check' : 'uncheck', selectors });
        }
      }, true);

      // Keyboard (Enter, Escape, Tab)
      document.addEventListener('keydown', (e) => {
        if (['Enter', 'Escape', 'Tab'].includes(e.key)) {
          const el = e.target;
          const selectors = el && el !== document.body ? window.__testflowRecorder.getSelectors(el) : [];
          sendAction({ type: 'press_key', selectors, key: e.key });
        }
      }, true);

      console.log('[TestFlow Recorder] Active — recording user actions');
    })();
  `;
}

export async function startRecording(url: string, headed: boolean, send: EventSender): Promise<RecordingSession> {
  const browser = await chromium.launch({ headless: !headed, slowMo: 0 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Expose function for recorder script to send actions
  await page.exposeFunction('__testflowSendAction', (actionJson: string) => {
    try {
      const action = JSON.parse(actionJson);
      const step = actionToStep(action);
      send({ type: 'record-step', data: { step, raw: action } });
    } catch {}
  });

  // Listen for navigation
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const navUrl = page.url();
      if (navUrl && navUrl !== 'about:blank') {
        send({
          type: 'record-step',
          data: {
            step: { id: crypto.randomUUID(), type: 'navigate', params: { url: navUrl } },
            raw: { type: 'navigate', url: navUrl },
          },
        });
      }
    }
  });

  // Inject recorder on each navigation
  page.on('load', async () => {
    try {
      await page.evaluate(getRecorderInjectionScript());
    } catch {}
  });

  // Navigate to starting URL
  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  // Inject recorder script now
  try {
    await page.evaluate(getRecorderInjectionScript());
  } catch {}

  send({ type: 'record-started', data: { url: page.url() } });
  return { browser, context, page };
}

export async function stopRecording(session: RecordingSession): Promise<void> {
  try { await session.context.close(); } catch {}
  try { await session.browser.close(); } catch {}
}

function actionToStep(action: any): any {
  const id = crypto.randomUUID();
  const primarySelector = action.selectors?.[0]?.value || '';

  switch (action.type) {
    case 'click':
      return { id, type: 'click', params: { selector: primarySelector }, selectorSuggestions: action.selectors };
    case 'fill':
      return { id, type: 'fill', params: { selector: primarySelector, value: action.value || '' }, selectorSuggestions: action.selectors };
    case 'select':
      return { id, type: 'select', params: { selector: primarySelector, value: action.value || '' }, selectorSuggestions: action.selectors };
    case 'check':
    case 'uncheck':
      return { id, type: action.type, params: { selector: primarySelector }, selectorSuggestions: action.selectors };
    case 'press_key':
      return { id, type: 'press_key', params: { selector: primarySelector, key: action.key }, selectorSuggestions: action.selectors };
    case 'navigate':
      return { id, type: 'navigate', params: { url: action.url } };
    default:
      return { id, type: action.type, params: { selector: primarySelector } };
  }
}
