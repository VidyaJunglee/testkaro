/**
 * Script to inject into the iframe that wraps console methods and
 * fetch/XHR to report back to the parent via postMessage.
 * This returns the script as a string to be injected.
 */
export function getConsoleInjectorScript(): string {
  return `
(function() {
  // --- Console interception ---
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  function sendToParent(type, data) {
    window.parent.postMessage({ __testkaro: true, type: type, data: data }, '*');
  }

  ['log', 'warn', 'error', 'info', 'debug'].forEach(function(level) {
    console[level] = function() {
      var args = Array.from(arguments).map(function(arg) {
        try { return typeof arg === 'object' ? JSON.stringify(arg) : String(arg); }
        catch(e) { return String(arg); }
      });
      sendToParent('console', { level: level, message: args.join(' '), timestamp: Date.now() });
      originalConsole[level].apply(console, arguments);
    };
  });

  // --- Uncaught error interception ---
  window.addEventListener('error', function(event) {
    sendToParent('console', {
      level: 'error',
      message: event.message + ' at ' + event.filename + ':' + event.lineno,
      timestamp: Date.now()
    });
  });

  window.addEventListener('unhandledrejection', function(event) {
    sendToParent('console', {
      level: 'error',
      message: 'Unhandled Promise: ' + (event.reason?.message || String(event.reason)),
      timestamp: Date.now()
    });
  });

  // --- Network interception (fetch) ---
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input.url || '');
    var method = (init && init.method) || 'GET';
    var startTime = Date.now();
    var id = Math.random().toString(36).substr(2, 9);

    sendToParent('network', {
      id: id, phase: 'request', method: method, url: url, timestamp: startTime
    });

    return originalFetch.apply(window, arguments).then(function(response) {
      var duration = Date.now() - startTime;
      response.clone().text().then(function(body) {
        sendToParent('network', {
          id: id, phase: 'response', method: method, url: url,
          status: response.status, duration: duration,
          size: body.length, timestamp: Date.now()
        });
      });
      return response;
    }).catch(function(err) {
      sendToParent('network', {
        id: id, phase: 'error', method: method, url: url,
        error: err.message, duration: Date.now() - startTime, timestamp: Date.now()
      });
      throw err;
    });
  };

  // --- Network interception (XHR) ---
  var OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    var xhr = new OrigXHR();
    var meta = { method: 'GET', url: '', id: Math.random().toString(36).substr(2, 9), startTime: 0 };

    var origOpen = xhr.open;
    xhr.open = function(method, url) {
      meta.method = method;
      meta.url = url;
      return origOpen.apply(xhr, arguments);
    };

    var origSend = xhr.send;
    xhr.send = function() {
      meta.startTime = Date.now();
      sendToParent('network', {
        id: meta.id, phase: 'request', method: meta.method, url: meta.url, timestamp: meta.startTime
      });

      xhr.addEventListener('loadend', function() {
        var duration = Date.now() - meta.startTime;
        sendToParent('network', {
          id: meta.id, phase: 'response', method: meta.method, url: meta.url,
          status: xhr.status, duration: duration,
          size: (xhr.responseText || '').length, timestamp: Date.now()
        });
      });

      xhr.addEventListener('error', function() {
        sendToParent('network', {
          id: meta.id, phase: 'error', method: meta.method, url: meta.url,
          error: 'Network error', duration: Date.now() - meta.startTime, timestamp: Date.now()
        });
      });

      return origSend.apply(xhr, arguments);
    };

    return xhr;
  };

  sendToParent('ready', { timestamp: Date.now() });
})();
`;
}
