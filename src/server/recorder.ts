import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface RecordingSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  mode: 'action' | 'assert';
}

type EventSender = (event: any) => void;

/**
 * Generates multiple selector suggestions for an element.
 * Priority: data-testid > id > aria-label > placeholder > role > text > CSS path
 */
function getSelectorGeneratorScript(): string {
  return `
    window.__testkaroRecorder = {
      getSelectors(el) {
        const selectors = [];

        // data-testid / data-test-id / data-cy
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy');
        if (testId) selectors.push({ type: 'testid', value: '[data-testid="' + testId + '"]', confidence: 1.0 });

        // id
        if (el.id) selectors.push({ type: 'id', value: '#' + CSS.escape(el.id), confidence: 0.95 });

        // aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) selectors.push({ type: 'aria', value: '[aria-label="' + ariaLabel + '"]', confidence: 0.9 });

        // placeholder (for inputs)
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) selectors.push({ type: 'placeholder', value: '[placeholder="' + placeholder + '"]', confidence: 0.85 });

        // name attribute (for form elements)
        const name = el.getAttribute('name');
        if (name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
          selectors.push({ type: 'name', value: '[name="' + name + '"]', confidence: 0.8 });
        }

        // role + name
        const role = el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : el.tagName === 'A' ? 'link' : null);
        const accessibleName = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30);
        if (role && accessibleName) selectors.push({ type: 'role', value: 'role=' + role + '[name="' + accessibleName + '"]', confidence: 0.7 });

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

function getRecorderInjectionScript(mode: 'action' | 'assert' = 'action'): string {
  return `
    ${getSelectorGeneratorScript()}

    (function() {
      // Prevent double-injection
      if (window.__testkaroRecorderActive) return;
      window.__testkaroRecorderActive = true;
      window.__testkaroMode = '${mode}';

      // ─── STATE ─────────────────────────────────────────────────────────────
      let pendingFill = null;   // { el, selectors, value }
      let highlightEl = null;
      let tooltipEl = null;
      let hoveredEl = null;

      function sendAction(action) {
        window.__testkaroSendAction(JSON.stringify(action));
      }

      // ─── HELPERS ───────────────────────────────────────────────────────────
      function isInputLike(el) {
        if (!el) return false;
        const tag = el.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true;
        if (el.contentEditable === 'true') return true;
        if (el.getAttribute('role') === 'textbox') return true;
        // Check if it's a wrapper around an input (click landed on label/div but input is inside)
        if (el.querySelector && el.querySelector('input, textarea, [contenteditable="true"]')) return true;
        return false;
      }

      function getInputEl(el) {
        // If clicked on a wrapper, find the actual input inside
        if (['INPUT', 'TEXTAREA'].includes(el.tagName)) return el;
        if (el.contentEditable === 'true') return el;
        const inner = el.querySelector && el.querySelector('input, textarea, [contenteditable="true"]');
        return inner || el;
      }

      // ─── FLUSH PENDING FILL ────────────────────────────────────────────────
      // Only emits when user leaves the field or clicks elsewhere
      function flushPendingFill() {
        if (pendingFill) {
          sendAction({
            type: 'fill',
            selectors: pendingFill.selectors,
            value: pendingFill.value,
            tagName: pendingFill.el.tagName,
          });
          pendingFill = null;
        }
      }

      // ─── HOVER HIGHLIGHT OVERLAY + TOOLTIP ─────────────────────────────────
      function createHighlight() {
        const el = document.createElement('div');
        el.id = '__testkaro-highlight';
        el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;transition:top 0.05s,left 0.05s,width 0.05s,height 0.05s;display:none;';
        // Border
        el.innerHTML = \`
          <div style="position:absolute;inset:0;border:2px solid #6366f1;border-radius:4px;"></div>
          <div style="position:absolute;inset:0;background:rgba(99,102,241,0.06);border-radius:4px;"></div>
        \`;
        document.documentElement.appendChild(el);
        return el;
      }

      function createTooltip() {
        const el = document.createElement('div');
        el.id = '__testkaro-tooltip';
        el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;display:none;padding:4px 8px;border-radius:4px;font:11px/1.3 monospace;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        document.documentElement.appendChild(el);
        return el;
      }

      highlightEl = document.getElementById('__testkaro-highlight') || createHighlight();
      tooltipEl = document.getElementById('__testkaro-tooltip') || createTooltip();

      function updateHighlight(el) {
        if (!el || el === document.body || el === document.documentElement || el === highlightEl || el === tooltipEl) {
          highlightEl.style.display = 'none';
          tooltipEl.style.display = 'none';
          hoveredEl = null;
          return;
        }
        hoveredEl = el;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        highlightEl.style.top = rect.top + 'px';
        highlightEl.style.left = rect.left + 'px';
        highlightEl.style.width = rect.width + 'px';
        highlightEl.style.height = rect.height + 'px';
        highlightEl.style.display = 'block';

        // Color based on mode
        const borderDiv = highlightEl.firstElementChild;
        const bgDiv = highlightEl.lastElementChild;
        if (window.__testkaroMode === 'assert') {
          borderDiv.style.borderColor = '#f59e0b';
          bgDiv.style.background = 'rgba(245,158,11,0.06)';
        } else {
          borderDiv.style.borderColor = '#6366f1';
          bgDiv.style.background = 'rgba(99,102,241,0.06)';
        }

        // Tooltip showing selector + tag
        const selectors = window.__testkaroRecorder.getSelectors(el);
        const bestSelector = selectors[0]?.value || el.tagName.toLowerCase();
        const tag = el.tagName.toLowerCase();
        tooltipEl.textContent = tag + ' → ' + bestSelector;
        tooltipEl.style.display = 'block';
        tooltipEl.style.background = window.__testkaroMode === 'assert' ? '#451a03' : '#1e1b4b';
        tooltipEl.style.color = window.__testkaroMode === 'assert' ? '#fbbf24' : '#a5b4fc';

        // Position tooltip below the element (or above if no space)
        const tooltipTop = rect.bottom + 6;
        const tooltipLeft = Math.min(rect.left, window.innerWidth - 290);
        if (tooltipTop + 30 > window.innerHeight) {
          tooltipEl.style.top = (rect.top - 28) + 'px';
        } else {
          tooltipEl.style.top = tooltipTop + 'px';
        }
        tooltipEl.style.left = Math.max(4, tooltipLeft) + 'px';
      }

      document.addEventListener('mouseover', (e) => updateHighlight(e.target), true);
      document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget || e.relatedTarget === document) {
          highlightEl.style.display = 'none';
          tooltipEl.style.display = 'none';
        }
      }, true);

      // ─── CLICK LISTENER ────────────────────────────────────────────────────
      // Single clicks are debounced briefly so a following dblclick can cancel
      // and replace them with a double_click step instead of recording both.
      let clickTimer = null;
      document.addEventListener('click', (e) => {
        const el = e.target;
        if (!el || el === document.body || el.id === '__testkaro-highlight' || el.id === '__testkaro-tooltip') return;

        // If we have a pending fill from a different element, flush it
        if (pendingFill && pendingFill.el !== el && pendingFill.el !== getInputEl(el)) {
          flushPendingFill();
        }

        const selectors = window.__testkaroRecorder.getSelectors(el);

        // ─── ASSERT MODE ───────────────────────────────────────────────────
        if (window.__testkaroMode === 'assert') {
          const text = el.textContent?.trim()?.slice(0, 200) || '';
          const isInput = isInputLike(el);
          if (isInput) {
            const inputEl = getInputEl(el);
            sendAction({ type: 'assert_value', selectors, expected: inputEl.value || '' });
          } else if (text) {
            sendAction({ type: 'assert_text', selectors, expected: text });
          } else {
            sendAction({ type: 'assert_visible', selectors });
          }
          return;
        }

        // ─── ACTION MODE ───────────────────────────────────────────────────
        // Suppress click on input-like elements (fill implies focus)
        if (isInputLike(el)) {
          return;
        }

        if (e.detail > 1) return; // part of a multi-click sequence — dblclick handler records it
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickTimer = null;
          sendAction({
            type: 'click',
            selectors,
            tagName: el.tagName,
            text: el.textContent?.trim()?.slice(0, 50),
          });
        }, 280);
      }, true);

      // ─── DOUBLE CLICK ──────────────────────────────────────────────────────
      document.addEventListener('dblclick', (e) => {
        if (window.__testkaroMode !== 'action') return;
        const el = e.target;
        if (!el || isInputLike(el)) return;
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        const selectors = window.__testkaroRecorder.getSelectors(el);
        sendAction({ type: 'double_click', selectors, tagName: el.tagName });
      }, true);

      // ─── RIGHT CLICK — recorded as a step instead of showing the native menu ──
      document.addEventListener('contextmenu', (e) => {
        if (window.__testkaroMode !== 'action') return;
        const el = e.target;
        if (!el) return;
        e.preventDefault();
        const selectors = window.__testkaroRecorder.getSelectors(el);
        sendAction({ type: 'right_click', selectors, tagName: el.tagName });
      }, true);

      // ─── ASSERT WITHOUT CLICKING ───────────────────────────────────────────
      // Hover an element and press "A" to assert on it, avoiding side effects
      // (e.g. navigation) that an actual click on it would trigger.
      document.addEventListener('keydown', (e) => {
        if (window.__testkaroMode !== 'assert') return;
        if (e.key !== 'a' && e.key !== 'A') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const active = document.activeElement;
        if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
        if (!hoveredEl) return;
        e.preventDefault();
        const selectors = window.__testkaroRecorder.getSelectors(hoveredEl);
        const text = hoveredEl.textContent?.trim()?.slice(0, 200) || '';
        const isInput = isInputLike(hoveredEl);
        if (isInput) {
          const inputEl = getInputEl(hoveredEl);
          sendAction({ type: 'assert_value', selectors, expected: inputEl.value || '' });
        } else if (text) {
          sendAction({ type: 'assert_text', selectors, expected: text });
        } else {
          sendAction({ type: 'assert_visible', selectors });
        }
      }, true);

      // ─── INPUT LISTENER (ACCUMULATE ONLY — NO EMIT) ────────────────────────
      document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el || !('value' in el)) return;
        if (window.__testkaroMode === 'assert') return;

        const selectors = window.__testkaroRecorder.getSelectors(el);

        // Just accumulate — only emit on blur or when clicking another element
        pendingFill = { el, selectors, value: el.value };
      }, true);

      // ─── BLUR LISTENER (PRIMARY FILL EMIT) ─────────────────────────────────
      document.addEventListener('blur', (e) => {
        const el = e.target;
        if (pendingFill && pendingFill.el === el) {
          flushPendingFill();
        }
      }, true);

      // ─── FOCUSOUT (BACKUP — catches cases blur misses) ─────────────────────
      document.addEventListener('focusout', (e) => {
        const el = e.target;
        if (pendingFill && pendingFill.el === el) {
          // Small delay to allow click handler to fire first
          setTimeout(() => {
            if (pendingFill && pendingFill.el === el) {
              flushPendingFill();
            }
          }, 50);
        }
      }, true);

      // ─── SELECT CHANGE ─────────────────────────────────────────────────────
      document.addEventListener('change', (e) => {
        const el = e.target;
        if (window.__testkaroMode === 'assert') return;

        if (el && el.tagName === 'SELECT') {
          const selectors = window.__testkaroRecorder.getSelectors(el);
          sendAction({ type: 'select', selectors, value: el.value });
        }
        if (el && el.type === 'checkbox') {
          const selectors = window.__testkaroRecorder.getSelectors(el);
          sendAction({ type: el.checked ? 'check' : 'uncheck', selectors });
        }
        if (el && el.type === 'radio') {
          const selectors = window.__testkaroRecorder.getSelectors(el);
          sendAction({ type: 'check', selectors });
        }
        if (el && el.type === 'file') {
          // Browsers only expose the filename, not the full path — the recorded
          // step needs its "path" param filled in with a real path before running.
          const selectors = window.__testkaroRecorder.getSelectors(el);
          const fileName = el.files && el.files[0] ? el.files[0].name : '';
          sendAction({ type: 'upload_file', selectors, path: fileName, needsPath: true });
        }
      }, true);

      // ─── KEYBOARD (SPECIAL KEYS ONLY) ──────────────────────────────────────
      document.addEventListener('keydown', (e) => {
        if (!['Enter', 'Escape', 'Tab'].includes(e.key)) return;
        if (window.__testkaroMode === 'assert') return;

        // Tab/Enter means user is done typing — flush fill first
        if ((e.key === 'Enter' || e.key === 'Tab') && pendingFill) {
          flushPendingFill();
        }

        const el = e.target;
        const selectors = el && el !== document.body ? window.__testkaroRecorder.getSelectors(el) : [];
        sendAction({ type: 'press_key', selectors, key: e.key });
      }, true);

      // ─── BEFOREUNLOAD — flush pending on page leave ────────────────────────
      window.addEventListener('beforeunload', () => {
        flushPendingFill();
      });

      console.log('[TestKaro Recorder] Active — mode: ' + window.__testkaroMode);
    })();
  `;
}

function getModeUpdateScript(mode: 'action' | 'assert'): string {
  return `window.__testkaroMode = '${mode}';`;
}

// ─── Smart Wait Detection ──────────────────────────────────────────────────────
// Tracks when elements appear dynamically to inject wait_for_element steps

function getSmartWaitScript(): string {
  return `
    (function() {
      if (window.__testkaroWaitTracker) return;
      window.__testkaroWaitTracker = true;

      const appeared = new Map(); // selector -> timestamp of appearance

      const observer = new MutationObserver((mutations) => {
        const now = Date.now();
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            // Track when significant interactive elements appear
            const el = node;
            if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.getAttribute('role')) {
              const selectors = window.__testkaroRecorder?.getSelectors(el);
              if (selectors && selectors.length > 0) {
                appeared.set(selectors[0].value, now);
              }
            }
            // Also check children
            el.querySelectorAll?.('button, a, input, select, textarea, [role]')?.forEach(child => {
              const childSelectors = window.__testkaroRecorder?.getSelectors(child);
              if (childSelectors && childSelectors.length > 0) {
                appeared.set(childSelectors[0].value, now);
              }
            });
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Expose for the recorder to check
      window.__testkaroElementAppearTime = (selector) => {
        return appeared.get(selector) || null;
      };
      window.__testkaroPageLoadTime = Date.now();
    })();
  `;
}

/**
 * DOM Overlay Script — "Browser Use" style
 * Shows ALL interactive elements on page with colored boxes + numbered labels.
 * Different colors per element type:
 *   Button = blue, Input = green, Link = purple, Select = orange, Other = gray
 */
function getDomOverlayScript(): string {
  return `
    (function() {
      if (window.__testkaroDomOverlayActive) {
        // Toggle off
        window.__testkaroDomOverlayActive = false;
        document.getElementById('__testkaro-overlay-container')?.remove();
        if (window.__testkaroOverlayObserver) {
          window.__testkaroOverlayObserver.disconnect();
          window.__testkaroOverlayObserver = null;
        }
        return;
      }

      window.__testkaroDomOverlayActive = true;

      const COLORS = {
        BUTTON: { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', label: '#1d4ed8', labelBg: '#dbeafe' },
        INPUT:  { border: '#10b981', bg: 'rgba(16,185,129,0.08)', label: '#065f46', labelBg: '#d1fae5' },
        TEXTAREA: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', label: '#065f46', labelBg: '#d1fae5' },
        SELECT: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: '#92400e', labelBg: '#fef3c7' },
        A:      { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', label: '#5b21b6', labelBg: '#ede9fe' },
        DEFAULT:{ border: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: '#374151', labelBg: '#f3f4f6' },
      };

      function getColor(el) {
        const tag = el.tagName;
        if (tag === 'BUTTON' || el.getAttribute('role') === 'button' || el.type === 'submit') return COLORS.BUTTON;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el.contentEditable === 'true') return COLORS.INPUT;
        if (tag === 'SELECT') return COLORS.SELECT;
        if (tag === 'A') return COLORS.A;
        return COLORS.DEFAULT;
      }

      function getInteractiveElements() {
        const selector = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [contenteditable="true"], [onclick], [tabindex]:not([tabindex="-1"])';
        const els = Array.from(document.querySelectorAll(selector));
        // Filter visible only
        return els.filter(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
          // Must be in viewport (roughly)
          if (rect.bottom < 0 || rect.top > window.innerHeight + 100) return false;
          if (rect.right < 0 || rect.left > window.innerWidth + 100) return false;
          return true;
        });
      }

      function createContainer() {
        let container = document.getElementById('__testkaro-overlay-container');
        if (container) container.remove();
        container = document.createElement('div');
        container.id = '__testkaro-overlay-container';
        container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483640;';
        document.documentElement.appendChild(container);
        return container;
      }

      function renderOverlay() {
        if (!window.__testkaroDomOverlayActive) return;
        const container = createContainer();
        const elements = getInteractiveElements();

        elements.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          const color = getColor(el);
          const num = index + 1;

          // Box
          const box = document.createElement('div');
          box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid ' + color.border + ';background:' + color.bg + ';border-radius:3px;box-sizing:border-box;';
          box.style.top = rect.top + 'px';
          box.style.left = rect.left + 'px';
          box.style.width = rect.width + 'px';
          box.style.height = rect.height + 'px';

          // Label (numbered badge)
          const label = document.createElement('div');
          label.style.cssText = 'position:absolute;top:-10px;left:-6px;min-width:18px;height:18px;border-radius:9px;font:bold 10px/18px system-ui,sans-serif;text-align:center;padding:0 4px;color:' + color.label + ';background:' + color.labelBg + ';border:1px solid ' + color.border + ';box-shadow:0 1px 3px rgba(0,0,0,0.15);';
          label.textContent = String(num);
          box.appendChild(label);

          container.appendChild(box);
        });
      }

      renderOverlay();

      // Re-render on scroll/resize
      let rafId = null;
      function scheduleRender() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => { rafId = null; renderOverlay(); });
      }
      window.addEventListener('scroll', scheduleRender, true);
      window.addEventListener('resize', scheduleRender, true);

      // Re-render on DOM mutations (debounced)
      let mutTimer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(mutTimer);
        mutTimer = setTimeout(renderOverlay, 200);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'disabled'] });
      window.__testkaroOverlayObserver = observer;

      // Expose refresh function
      window.__testkaroRefreshOverlay = renderOverlay;
    })();
  `;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function startRecording(url: string, headed: boolean, send: EventSender): Promise<RecordingSession> {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const session: RecordingSession = { browser, context, page, mode: 'action' };

  // Action deduplication state — shared across every page recording attaches to,
  // so a redirect landing on the same selector within the window still dedupes.
  let lastAction: { type: string; selector: string; value?: string; time: number } | null = null;
  let lastNavUrl = '';
  let lastNavTime = 0;

  // ─── BROWSER CLOSE DETECTION ─────────────────────────────────────────────
  // Guard against double-firing (page close + browser disconnect both fire)
  let closeSent = false;
  const sendClose = (reason: string) => {
    if (closeSent) return;
    closeSent = true;
    try { send({ type: 'record-done', data: { reason } }); } catch {}
  };

  // Wires the recorder's action/navigation listeners onto a page and injects
  // the recorder script. Called for the initial page, again after every
  // same-page navigation (via 'load'), and for any new tab/window that opens
  // during recording (target=_blank, window.open, OAuth/payment redirects) —
  // that's how recording focus follows a redirect instead of going stale on
  // whichever page happened to be open first.
  const attachToPage = async (target: Page) => {
    try {
      await target.exposeFunction('__testkaroSendAction', (actionJson: string) => {
        try {
          const action = JSON.parse(actionJson);
          const selector = action.selectors?.[0]?.value || '';
          const now = Date.now();

          if (lastAction && action.type === lastAction.type && selector === lastAction.selector && now - lastAction.time < 300) {
            if (action.type === 'fill') lastAction.value = action.value;
            return;
          }

          lastAction = { type: action.type, selector, value: action.value, time: now };
          const step = actionToStep(action);
          send({ type: 'record-step', data: { step, raw: action } });
        } catch {}
      });
    } catch {
      // Already exposed on this page (re-attach after in-page navigation) — fine.
    }

    target.on('framenavigated', (frame) => {
      if (session.page !== target || frame !== target.mainFrame()) return;
      const navUrl = target.url();
      const now = Date.now();
      if (navUrl && navUrl !== 'about:blank' && (navUrl !== lastNavUrl || now - lastNavTime > 500)) {
        lastNavUrl = navUrl;
        lastNavTime = now;
        send({
          type: 'record-step',
          data: {
            step: { id: crypto.randomUUID(), type: 'navigate', params: { url: navUrl } },
            raw: { type: 'navigate', url: navUrl },
          },
        });
      }
    });

    target.on('load', async () => {
      if (session.page !== target) return;
      try {
        await target.evaluate(getSmartWaitScript());
        await target.evaluate(getRecorderInjectionScript(session.mode));
      } catch {}
    });

    // Only treat this page closing as "recording over" if it's still the
    // active one — an old tab closing after a redirect handoff is expected.
    target.on('close', () => {
      if (session.page === target) sendClose('browser-closed');
    });

    try {
      await target.evaluate(getSmartWaitScript());
      await target.evaluate(getRecorderInjectionScript(session.mode));
    } catch {}
  };

  // A new tab/window appearing mid-recording means the site redirected the
  // user out of the original page — move recording focus to it.
  context.on('page', async (newPage) => {
    if (newPage === page || newPage === session.page) return;
    try {
      await newPage.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
      session.page = newPage;
      lastNavUrl = '';
      await attachToPage(newPage);
      send({ type: 'record-focus-changed', data: { url: newPage.url() } });
      const navUrl = newPage.url();
      if (navUrl && navUrl !== 'about:blank') {
        lastNavUrl = navUrl;
        lastNavTime = Date.now();
        send({
          type: 'record-step',
          data: {
            step: { id: crypto.randomUUID(), type: 'navigate', params: { url: navUrl } },
            raw: { type: 'navigate', url: navUrl },
          },
        });
      }
    } catch {}
  });

  await attachToPage(page);

  // Navigate to starting URL
  if (url) {
    await page.goto(url, { waitUntil: 'load' });
    lastNavUrl = page.url();
  }

  send({ type: 'record-started', data: { url: page.url() } });

  context.on('close', () => sendClose('context-closed'));
  browser.on('disconnected', () => sendClose('browser-disconnected'));

  return session;
}

export async function setRecordingMode(session: RecordingSession, mode: 'action' | 'assert'): Promise<void> {
  session.mode = mode;
  try {
    await session.page.evaluate(getModeUpdateScript(mode));
  } catch {}
}

export async function toggleDomOverlay(session: RecordingSession): Promise<void> {
  try {
    await session.page.evaluate(getDomOverlayScript());
  } catch {}
}

export async function stopRecording(session: RecordingSession): Promise<void> {
  try { await session.page.close().catch(() => {}); } catch {}
  try { await session.context.close().catch(() => {}); } catch {}
  try { await session.browser.close().catch(() => {}); } catch {}
}

function actionToStep(action: any): any {
  const id = crypto.randomUUID();
  const primarySelector = action.selectors?.[0]?.value || '';
  const selectorSuggestions = action.selectors || [];

  switch (action.type) {
    case 'click':
      return { id, type: 'click', params: { selector: primarySelector }, selectorSuggestions };
    case 'fill':
      return { id, type: 'fill', params: { selector: primarySelector, value: action.value || '' }, selectorSuggestions };
    case 'select':
      return { id, type: 'select', params: { selector: primarySelector, value: action.value || '' }, selectorSuggestions };
    case 'check':
    case 'uncheck':
    case 'double_click':
    case 'right_click':
      return { id, type: action.type, params: { selector: primarySelector }, selectorSuggestions };
    case 'upload_file':
      return {
        id, type: 'upload_file',
        params: { selector: primarySelector, path: action.path || '' },
        selectorSuggestions,
        description: action.needsPath ? 'Recorded filename only — replace "path" with a real file path before running' : undefined,
      };
    case 'press_key':
      return { id, type: 'press_key', params: { selector: primarySelector, key: action.key }, selectorSuggestions };
    case 'navigate':
      return { id, type: 'navigate', params: { url: action.url } };
    case 'assert_visible':
      return { id, type: 'assert_visible', params: { selector: primarySelector }, selectorSuggestions };
    case 'assert_text':
      return { id, type: 'assert_text', params: { selector: primarySelector, expected: action.expected || '' }, selectorSuggestions };
    case 'assert_value':
      return { id, type: 'assert_value', params: { selector: primarySelector, expected: action.expected || '' }, selectorSuggestions };
    default:
      return { id, type: action.type, params: { selector: primarySelector }, selectorSuggestions };
  }
}
