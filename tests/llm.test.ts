/**
 * Tests for LLM adapters: OpenAI, Anthropic, and Compact formats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecBuilder } from '../src/builder/SpecBuilder.js';
import { OperationBuilder } from '../src/builder/OperationBuilder.js';
import { toLLM, toOpenAITools, toAnthropicTools, toCompact } from '../src/llm/index.js';
import type { OpenAPIDocument } from '../src/types/openapi3_1.js';
import { z } from 'zod';

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

function buildTestSpec(): OpenAPIDocument {
  return new SpecBuilder()
    .title('Test API')
    .version('1.0.0')
    .description('A test API for LLM adapter tests')
    .server('https://api.example.com', 'Production')
    .bearerAuth()
    .component('User', z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    }))
    .component('Error', z.object({ error: z.string() }))
    .add('/users', 'get',
      new OperationBuilder()
        .operationId('listUsers')
        .summary('List users')
        .description('Returns paginated list of users.')
        .tag('Users')
        .query('page', z.number().int().min(1).default(1), 'Page number')
        .query('limit', z.number().int().min(1).max(100).default(20), 'Items per page')
        .response(200, z.object({
          users: z.array(z.object({ id: z.string(), name: z.string() })),
          total: z.number(),
        }), 'User list')
        .response(401, '#/components/schemas/Error', 'Unauthorized')
    )
    .add('/users/:id', 'get',
      new OperationBuilder()
        .operationId('getUserById')
        .summary('Get user by ID')
        .tag('Users')
        .pathParam('id', z.string().uuid(), 'User UUID')
        .response(200, '#/components/schemas/User', 'User found')
        .response(404, '#/components/schemas/Error', 'Not found')
    )
    .add('/users', 'post',
      new OperationBuilder()
        .operationId('createUser')
        .summary('Create a user')
        .tag('Users')
        .body(z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }), 'User data')
        .response(201, '#/components/schemas/User', 'Created')
        .response(400, '#/components/schemas/Error', 'Validation error')
    )
    .add('/users/:id', 'delete',
      new OperationBuilder()
        .operationId('deleteUser')
        .summary('Delete user')
        .tag('Users')
        .pathParam('id', z.string().uuid(), 'User UUID')
        .noContent(204)
        .response(404, '#/components/schemas/Error', 'Not found')
    )
    .build();
}

// ─── OpenAI Adapter Tests ──────────────────────────────────────────────────────

describe('OpenAI adapter', () => {
  let spec: OpenAPIDocument;

  beforeEach(() => {
    spec = buildTestSpec();
  });

  it('should return an array of tools', () => {
    const tools = toOpenAITools(spec);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should produce tools with correct structure', () => {
    const tools = toOpenAITools(spec);
    for (const tool of tools) {
      expect(tool.type).toBe('function');
      expect(tool.function).toBeDefined();
      expect(tool.function.name).toBeDefined();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('should use operationId as function name', () => {
    const tools = toOpenAITools(spec);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain('listUsers');
    expect(names).toContain('getUserById');
    expect(names).toContain('createUser');
    expect(names).toContain('deleteUser');
  });

  it('should include query parameters as function properties', () => {
    const tools = toOpenAITools(spec);
    const listTool = tools.find((t) => t.function.name === 'listUsers');
    expect(listTool).toBeDefined();
    expect(listTool!.function.parameters.properties['page']).toBeDefined();
    expect(listTool!.function.parameters.properties['limit']).toBeDefined();
  });

  it('should include path parameters as function properties', () => {
    const tools = toOpenAITools(spec);
    const getTool = tools.find((t) => t.function.name === 'getUserById');
    expect(getTool!.function.parameters.properties['id']).toBeDefined();
  });

  it('should mark path parameters as required', () => {
    const tools = toOpenAITools(spec);
    const getTool = tools.find((t) => t.function.name === 'getUserById');
    expect(getTool!.function.parameters.required).toContain('id');
  });

  it('should flatten body properties into function parameters', () => {
    const tools = toOpenAITools(spec);
    const createTool = tools.find((t) => t.function.name === 'createUser');
    expect(createTool!.function.parameters.properties['name']).toBeDefined();
    expect(createTool!.function.parameters.properties['email']).toBeDefined();
  });

  it('should include summary in description', () => {
    const tools = toOpenAITools(spec);
    const listTool = tools.find((t) => t.function.name === 'listUsers');
    expect(listTool!.function.description).toContain('List users');
  });

  it('should filter by tag', () => {
    const allTools = toOpenAITools(spec);
    const userTools = toOpenAITools(spec, { includeTags: ['Users'] });
    expect(userTools.length).toBe(allTools.length); // All our ops have 'Users' tag
  });

  it('should exclude by operationId', () => {
    const tools = toOpenAITools(spec, { excludeOperations: ['deleteUser'] });
    expect(tools.find((t) => t.function.name === 'deleteUser')).toBeUndefined();
  });

  it('should respect limit', () => {
    const tools = toOpenAITools(spec, { limit: 2 });
    expect(tools).toHaveLength(2);
  });

  it('should support strict mode', () => {
    const tools = toOpenAITools(spec, { strict: true });
    for (const tool of tools) {
      expect(tool.function.parameters.additionalProperties).toBe(false);
      expect(tool.function.strict).toBe(true);
    }
  });

  it('should work via toLLM.openai()', () => {
    const tools = toLLM.openai(spec);
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should handle empty paths', () => {
    const emptySpec: OpenAPIDocument = { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } };
    const tools = toOpenAITools(emptySpec);
    expect(tools).toEqual([]);
  });
});

// ─── Anthropic Adapter Tests ───────────────────────────────────────────────────

describe('Anthropic adapter', () => {
  let spec: OpenAPIDocument;

  beforeEach(() => {
    spec = buildTestSpec();
  });

  it('should return an array of tools', () => {
    const tools = toAnthropicTools(spec);
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should produce tools with correct Anthropic structure', () => {
    const tools = toAnthropicTools(spec);
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('should use operationId as tool name', () => {
    const tools = toAnthropicTools(spec);
    const names = tools.map((t) => t.name);
    expect(names).toContain('listUsers');
    expect(names).toContain('getUserById');
    expect(names).toContain('createUser');
    expect(names).toContain('deleteUser');
  });

  it('should include query parameters', () => {
    const tools = toAnthropicTools(spec);
    const listTool = tools.find((t) => t.name === 'listUsers');
    expect(listTool!.input_schema.properties!['page']).toBeDefined();
    expect(listTool!.input_schema.properties!['limit']).toBeDefined();
  });

  it('should mark path parameters as required', () => {
    const tools = toAnthropicTools(spec);
    const getTool = tools.find((t) => t.name === 'getUserById');
    expect(getTool!.input_schema.required).toContain('id');
  });

  it('should include endpoint in description by default', () => {
    const tools = toAnthropicTools(spec);
    const getTool = tools.find((t) => t.name === 'getUserById');
    expect(getTool!.description).toContain('/users/{id}');
  });

  it('should omit endpoint from description when disabled', () => {
    const tools = toAnthropicTools(spec, { includePathInDescription: false });
    const getTool = tools.find((t) => t.name === 'getUserById');
    expect(getTool!.description).not.toContain('/users/{id}');
  });

  it('should filter by tag', () => {
    const tools = toAnthropicTools(spec, { includeTags: ['Users'] });
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should exclude operations', () => {
    const tools = toAnthropicTools(spec, { excludeOperations: ['deleteUser'] });
    expect(tools.find((t) => t.name === 'deleteUser')).toBeUndefined();
  });

  it('should respect limit', () => {
    const tools = toAnthropicTools(spec, { limit: 1 });
    expect(tools).toHaveLength(1);
  });

  it('should work via toLLM.anthropic()', () => {
    const tools = toLLM.anthropic(spec);
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should handle empty paths', () => {
    const emptySpec: OpenAPIDocument = { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } };
    const tools = toAnthropicTools(emptySpec);
    expect(tools).toEqual([]);
  });
});

// ─── Compact Format Tests ──────────────────────────────────────────────────────

describe('Compact format', () => {
  let spec: OpenAPIDocument;

  beforeEach(() => {
    spec = buildTestSpec();
  });

  it('should produce a string', () => {
    const compact = toCompact(spec);
    expect(typeof compact).toBe('string');
    expect(compact.length).toBeGreaterThan(0);
  });

  it('should include API name and version', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('Test API');
    expect(compact).toContain('1.0.0');
  });

  it('should include base URL', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('https://api.example.com');
  });

  it('should include auth info', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('Bearer');
  });

  it('should include operation paths and methods', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('GET');
    expect(compact).toContain('/users');
    expect(compact).toContain('POST');
  });

  it('should include operation summaries', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('List users');
    expect(compact).toContain('Get user by ID');
    expect(compact).toContain('Create a user');
  });

  it('should include query parameters', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('Query:');
    expect(compact).toContain('page');
    expect(compact).toContain('limit');
  });

  it('should include path parameters', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('Path:');
    expect(compact).toContain('id');
  });

  it('should include response codes', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('→ 200');
    expect(compact).toContain('→ 401');
    expect(compact).toContain('→ 204');
  });

  it('should include schema definitions', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('Schemas:');
    expect(compact).toContain('User');
    expect(compact).toContain('Error');
  });

  it('should group by tags', () => {
    const compact = toCompact(spec);
    expect(compact).toContain('### Users');
  });

  it('should work via toLLM.compact()', () => {
    const compact = toLLM.compact(spec);
    expect(typeof compact).toBe('string');
  });

  it('should support excludeSchemas option', () => {
    const compact = toCompact(spec, { includeSchemas: false });
    expect(compact).not.toContain('Schemas:');
  });

  it('should support excludeServers option', () => {
    const compact = toCompact(spec, { includeServers: false });
    expect(compact).not.toContain('https://api.example.com');
  });

  it('should handle API with no paths', () => {
    const emptySpec: OpenAPIDocument = {
      openapi: '3.1.0',
      info: { title: 'Empty API', version: '1.0.0' },
    };
    const compact = toCompact(emptySpec);
    expect(compact).toContain('Empty API');
  });

  it('should produce token-efficient output', () => {
    const compact = toCompact(spec);
    // Should be significantly shorter than the full JSON
    const jsonLength = JSON.stringify(spec).length;
    expect(compact.length).toBeLessThan(jsonLength);
  });
});

// ─── toLLM namespace tests ─────────────────────────────────────────────────────

describe('toLLM namespace', () => {
  it('should have openai method', () => {
    expect(typeof toLLM.openai).toBe('function');
  });

  it('should have anthropic method', () => {
    expect(typeof toLLM.anthropic).toBe('function');
  });

  it('should have compact method', () => {
    expect(typeof toLLM.compact).toBe('function');
  });

  it('should produce consistent results from all adapters', () => {
    const spec = buildTestSpec();

    const openai = toLLM.openai(spec);
    const anthropic = toLLM.anthropic(spec);
    const compact = toLLM.compact(spec);

    // All should have the same number of operations
    expect(openai).toHaveLength(anthropic.length);
    expect(compact).toContain('API:');
  });
});
