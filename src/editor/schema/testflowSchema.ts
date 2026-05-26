import { BLOCKS } from '../blocks';

// JSON Schema that describes the .testflow.json format
// Monaco uses this for autocomplete, validation, and hover docs
export function getTestFlowSchema() {
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

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    description: 'TestFlow test file',
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
