# TestKaro

Visual test automation studio — build Playwright and API tests with drag-and-drop or JSON, run them locally or in CI.

## Features

- **Visual Step Builder** — drag-and-drop blocks to compose test flows without writing code
- **JSON-first** — tests stored as `.tk.json` files, fully versionable in git
- **Modular Architecture** — organize tests into modules within a project
- **28 Built-in Blocks** — navigation, interaction, assertion, API, logic, and data blocks
- **Live Execution** — run tests in real-time with step-by-step timeline, console, and network capture
- **Environment Variables** — global and per-app environments with variable interpolation (`{{var}}`)
- **Undo/Redo** — full temporal state with keyboard shortcuts
- **Dark Mode** — system-aware theme with manual toggle
- **CLI Runner** — execute tests headlessly in CI/CD pipelines

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start dev server (frontend + backend)
npm run dev
```

Open http://localhost:5173 to launch the editor.

## Project Structure

```
testkaro/
├── src/
│   ├── blocks/         # Block definitions (navigation, interaction, assertion, api, logic, data)
│   ├── schema/         # Core types — TestFile, TestCase, TestStep, BlockDefinition
│   ├── engine/         # Test executor — runs steps against Playwright
│   ├── server/         # WebSocket server for execution, recording, proxy
│   ├── proxy/          # CORS proxy for API testing
│   ├── cli/            # CLI runner for CI integration
│   └── editor/         # React frontend
│       ├── components/ # UI — Dashboard, TopBar, Sidebar, ModuleOverview, StepCard, etc.
│       ├── store/      # Zustand store (file, session, execution, UI, env slices)
│       ├── storage/    # IndexedDB persistence, filesystem sync, app registry
│       ├── engine/     # Browser-side executor with console/network capture
│       ├── router/     # Client-side hash router
│       └── providers/  # Storage provider abstraction (IndexedDB, File System Access API)
├── examples/           # Example test files
└── package.json
```

## Test File Format (`.tk.json`)

```json
{
  "version": "3.0.0",
  "name": "Login Module",
  "tests": [
    {
      "id": "test-1",
      "name": "Valid login redirects to dashboard",
      "steps": [
        { "id": "s1", "type": "navigate", "params": { "url": "{{baseUrl}}/login" } },
        { "id": "s2", "type": "fill", "params": { "selector": "#email", "value": "{{email}}" } },
        { "id": "s3", "type": "fill", "params": { "selector": "#password", "value": "{{password}}" } },
        { "id": "s4", "type": "click", "params": { "selector": "button[type=submit]" } },
        { "id": "s5", "type": "assert_url", "params": { "value": "/dashboard", "match": "contains" } }
      ]
    }
  ]
}
```

## Block Categories

| Category | Blocks |
|----------|--------|
| **Navigation** | `navigate`, `reload`, `go_back`, `go_forward`, `wait_for_url` |
| **Interaction** | `click`, `fill`, `type`, `select`, `checkbox`, `hover`, `press_key`, `scroll`, `upload` |
| **Assertion** | `assert_visible`, `assert_text`, `assert_text_equals`, `assert_url`, `assert_title`, `assert_element_count` |
| **API** | `api_request`, `assert_status`, `assert_body`, `extract_value` |
| **Logic** | `set_variable`, `if`, `repeat`, `for_each`, `try_catch`, `wait`, `log`, `fail` |
| **Data** | `screenshot`, `get_text`, `get_attribute`, `store_value` |

## CLI

```bash
# Run tests
npx testkaro run "tests/**/*.tk.json"

# Headed mode
npx testkaro run tests/ --headed

# With variables
npx testkaro run tests/ --var baseUrl=http://localhost:3000

# JUnit output for CI
npx testkaro run tests/ --reporter junit --output ./results
```

### Options

```
Options:
  -H, --headed           Show browser during execution
  -t, --timeout <ms>     Step timeout (default: 30000)
  -r, --reporter <type>  Reporter: console, json, junit
  -o, --output <dir>     Output directory for reports
  -b, --base-url <url>   Base URL for relative navigation
  -v, --var <vars...>    Variables as key=value
  --fail-fast            Stop on first failure
  --filter <pattern>     Only run tests matching name pattern
```

## CI/CD

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install chromium
      - run: npx testkaro run "tests/**/*.tk.json" --reporter junit --output results
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results/
```

## Development

```bash
npm run dev          # Start frontend + backend
npm run dev:server   # Backend only (WebSocket + proxy)
npm run dev:client   # Frontend only (Vite)
npm run build        # Production build
npm run typecheck    # TypeScript check
```

## License

MIT
