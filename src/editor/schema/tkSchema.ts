import { BLOCKS } from '../blocks';

// JSON Schema that describes the .tk.json format
// Monaco uses this for autocomplete, validation, and hover docs
export function getTkSchema() {
  const blockTypes = BLOCKS.map(b => b.type);

  // Build per-block param schemas
  const stepSchemas = BLOCKS.map(block => ({
    if: { properties: { type: { const: block.type } } },
    then: {
      properties: {
        params: {
          type: 'object' as const,
          properties: Object.fromEntries(
            block.inputs.map(input => [
              input.name,
              {
                type: input.type === 'number' ? 'number' : input.type === 'checkbox' ? 'boolean' : 'string',
                description: input.label + (input.required ? ' (required)' : ''),
                ...(input.default !== undefined ? { default: input.default } : {}),
                ...(input.options ? { enum: input.options.map(o => o.value) } : {}),
              },
            ])
          ),
          required: block.inputs.filter(i => i.required).map(i => i.name),
        },
      },
    },
  }));

  // Build defaultSnippets for step items — Monaco's JSON service uses these for autocomplete
  const stepSnippets = BLOCKS.map(block => {
    const params: Record<string, unknown> = {};
    block.inputs.forEach(input => {
      if (input.required || input.default !== undefined) {
        if (input.type === 'number') {
          params[input.name] = input.default ?? 0;
        } else if (input.type === 'checkbox') {
          params[input.name] = input.default ?? false;
        } else {
          params[input.name] = input.default ?? (input.placeholder || '');
        }
      }
    });
    return {
      label: `${block.label} (${block.type})`,
      description: block.description || `Add a ${block.type} step`,
      body: {
        id: '${1:${UUID}}',
        type: block.type,
        params,
      },
    };
  });

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    description: 'TestKaro test file',
    required: ['version', 'name', 'tests'],
    properties: {
      version: {
        type: 'string',
        description: 'Schema version',
        default: '1.0',
      },
      name: {
        type: 'string',
        description: 'Test suite name',
      },
      description: {
        type: 'string',
        description: 'Optional description of this test suite',
      },
      baseUrl: {
        type: 'string',
        description: 'Base URL prepended to relative navigation paths',
      },
      variables: {
        type: 'object',
        description: 'Variables available to all tests via ${name} syntax',
        additionalProperties: true,
      },
      engine: {
        type: 'string',
        enum: ['web', 'mobile'],
        description: 'Which executor runs this module\'s tests. Defaults to "web".',
      },
      mobileConfig: {
        type: 'object',
        description: 'Appium session config — only used when engine is "mobile"',
        properties: {
          platform: { type: 'string', enum: ['android', 'ios'] },
          deviceId: { type: 'string', description: 'adb serial or iOS simulator UDID' },
          appPath: { type: 'string', description: 'Path to a .apk/.app/.ipa to install before the session starts' },
          appPackage: { type: 'string', description: 'Android package id of an already-installed app' },
          appActivity: { type: 'string', description: 'Android activity to launch' },
          bundleId: { type: 'string', description: 'iOS bundle id of an already-installed app' },
        },
      },
      tests: {
        type: 'array',
        description: 'Test cases',
        items: {
          type: 'object',
          required: ['id', 'name', 'steps'],
          properties: {
            id: { type: 'string', description: 'Unique test identifier' },
            name: { type: 'string', description: 'Human-readable test name' },
            disabled: { type: 'boolean', description: 'Skip this test', default: false },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for filtering' },
            steps: {
              type: 'array',
              description: 'Test steps to execute in order',
              items: {
                type: 'object',
                required: ['id', 'type', 'params'],
                defaultSnippets: stepSnippets,
                properties: {
                  id: { type: 'string', description: 'Unique step identifier' },
                  type: {
                    type: 'string',
                    enum: blockTypes,
                    description: 'Block type to execute',
                  },
                  params: {
                    type: 'object',
                    description: 'Parameters for this block',
                  },
                  skip: {
                    type: 'boolean',
                    description: 'Skip this step during execution',
                    default: false,
                  },
                  description: {
                    type: 'string',
                    description: 'Optional note shown in the visual builder',
                  },
                  timeout: {
                    type: 'number',
                    description: 'Overrides this step\'s default timeout (ms). Ignored by container steps.',
                  },
                  retry: {
                    type: 'number',
                    description: 'Additional attempts on failure before the step is marked failed. Ignored by container steps.',
                  },
                  children: {
                    type: 'array',
                    description: 'Child steps (for container blocks like if/repeat)',
                    items: { $ref: '#/properties/tests/items/properties/steps/items' },
                  },
                },
                allOf: stepSchemas,
              },
            },
          },
        },
      },
    },
  };
}
