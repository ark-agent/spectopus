/**
 * Tests for SpecBuilder and OperationBuilder.
 * Ensures that the fluent API produces valid OpenAPI 3.1 output.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecBuilder } from '../src/builder/SpecBuilder.js';
import { OperationBuilder } from '../src/builder/OperationBuilder.js';
import { ComponentsBuilder } from '../src/builder/ComponentsBuilder.js';
import { normalizePath, generateOperationId } from '../src/builder/SpecBuilder.js';
import { validateSpec } from '../src/utils/validate.js';
import { z } from 'zod';

// ─── SpecBuilder Tests ─────────────────────────────────────────────────────────

describe('SpecBuilder', () => {
  let builder: SpecBuilder;

  beforeEach(() => {
    builder = new SpecBuilder();
  });

  describe('info', () => {
    it('should set title and version', () => {
      const spec = builder.title('Test API').version('2.0.0').build();
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('2.0.0');
    });

    it('should set description', () => {
      const spec = builder.title('API').version('1.0.0').description('My API description').build();
      expect(spec.info.description).toBe('My API description');
    });

    it('should set summary', () => {
      const spec = builder.title('API').version('1.0.0').summary('Short summary').build();
      expect(spec.info.summary).toBe('Short summary');
    });

    it('should set contact info', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .contact('John', 'john@example.com', 'https://example.com')
        .build();
      expect(spec.info.contact).toEqual({
        name: 'John',
        email: 'john@example.com',
        url: 'https://example.com',
      });
    });

    it('should set license info', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .license('MIT', 'https://opensource.org/licenses/MIT')
        .build();
      expect(spec.info.license).toEqual({
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      });
    });

    it('should throw if title is missing', () => {
      expect(() => builder.version('1.0.0').build()).toThrow(/title is required/);
    });

    it('should throw if version is missing', () => {
      expect(() => builder.title('API').build()).toThrow(/version is required/);
    });
  });

  describe('servers', () => {
    it('should add a server', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .server('https://api.example.com', 'Production')
        .build();
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers![0].url).toBe('https://api.example.com');
      expect(spec.servers![0].description).toBe('Production');
    });

    it('should add multiple servers', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .server('https://api.example.com', 'Production')
        .server('http://localhost:3000', 'Development')
        .build();
      expect(spec.servers).toHaveLength(2);
    });
  });

  describe('paths', () => {
    it('should add an operation', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .add('/users', 'get', new OperationBuilder().summary('List users'))
        .build();

      expect(spec.paths).toBeDefined();
      expect(spec.paths!['/users']).toBeDefined();
      expect((spec.paths!['/users'] as { get: unknown }).get).toBeDefined();
    });

    it('should normalize Express-style paths', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .add('/users/:id', 'get', new OperationBuilder().summary('Get user'))
        .build();

      expect(spec.paths!['/users/{id}']).toBeDefined();
    });

    it('should add multiple operations on same path', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .add('/users', 'get', new OperationBuilder().summary('List users'))
        .add('/users', 'post', new OperationBuilder().summary('Create user'))
        .build();

      const pathItem = spec.paths!['/users'] as Record<string, unknown>;
      expect(pathItem['get']).toBeDefined();
      expect(pathItem['post']).toBeDefined();
    });

    it('should auto-generate operationId', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .add('/users/:id', 'get', new OperationBuilder())
        .build();

      const op = (spec.paths!['/users/{id}'] as { get: { operationId?: string } }).get;
      expect(op.operationId).toBe('getUsersById');
    });
  });

  describe('tags', () => {
    it('should define tags', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .tag('Users', 'User management operations')
        .build();
      expect(spec.tags).toHaveLength(1);
      expect(spec.tags![0].name).toBe('Users');
      expect(spec.tags![0].description).toBe('User management operations');
    });
  });

  describe('security', () => {
    it('should add bearer auth', () => {
      const spec = builder.title('API').version('1.0.0').bearerAuth().build();

      expect(spec.security).toEqual([{ bearerAuth: [] }]);
      expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    });

    it('should add API key auth', () => {
      const spec = builder.title('API').version('1.0.0').apiKeyAuth().build();

      expect(spec.security).toEqual([{ apiKey: [] }]);
      expect(spec.components?.securitySchemes?.apiKey).toBeDefined();
    });
  });

  describe('components', () => {
    it('should add a schema component', () => {
      const spec = builder
        .title('API')
        .version('1.0.0')
        .component('User', { type: 'object', properties: { id: { type: 'string' } } })
        .build();

      expect(spec.components?.schemas?.User).toBeDefined();
    });

    it('should add a Zod schema component', () => {
      const UserSchema = z.object({ id: z.string().uuid(), name: z.string() });
      const spec = builder
        .title('API')
        .version('1.0.0')
        .component('User', UserSchema)
        .build();

      const userSchema = spec.components?.schemas?.User as { type: string; properties: unknown };
      expect(userSchema.type).toBe('object');
      expect(userSchema.properties).toBeDefined();
    });
  });

  describe('immutability', () => {
    it('should be immutable — original builder is unchanged', () => {
      const base = new SpecBuilder().title('API').version('1.0.0');
      const withServer = base.server('https://api.example.com');
      const withoutServer = base.build();

      expect(withoutServer.servers).toBeUndefined();
      const withServerSpec = withServer.build();
      expect(withServerSpec.servers).toHaveLength(1);
    });
  });

  describe('toJSON', () => {
    it('should produce valid JSON', () => {
      const json = builder.title('API').version('1.0.0').toJSON();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('OpenAPI version', () => {
    it('should produce OpenAPI 3.1.0 by default', () => {
      const spec = builder.title('API').version('1.0.0').build();
      expect(spec.openapi).toBe('3.1.0');
    });
  });
});

// ─── OperationBuilder Tests ────────────────────────────────────────────────────

describe('OperationBuilder', () => {
  describe('basic properties', () => {
    it('should set summary', () => {
      const op = new OperationBuilder().summary('Test operation').build();
      expect(op.summary).toBe('Test operation');
    });

    it('should set description', () => {
      const op = new OperationBuilder().description('Long description').build();
      expect(op.description).toBe('Long description');
    });

    it('should add tags', () => {
      const op = new OperationBuilder().tag('Users').tag('Admin').build();
      expect(op.tags).toEqual(['Users', 'Admin']);
    });

    it('should not duplicate tags', () => {
      const op = new OperationBuilder().tag('Users').tag('Users').build();
      expect(op.tags).toHaveLength(1);
    });

    it('should mark as deprecated', () => {
      const op = new OperationBuilder().deprecated().build();
      expect(op.deprecated).toBe(true);
    });

    it('should set operationId', () => {
      const op = new OperationBuilder().operationId('listUsers').build();
      expect(op.operationId).toBe('listUsers');
    });
  });

  describe('parameters', () => {
    it('should add a query parameter', () => {
      const op = new OperationBuilder()
        .query('page', { type: 'integer', minimum: 1 }, 'Page number')
        .build();

      expect(op.parameters).toHaveLength(1);
      expect(op.parameters![0]).toMatchObject({
        name: 'page',
        in: 'query',
        description: 'Page number',
      });
    });

    it('should add a path parameter', () => {
      const op = new OperationBuilder()
        .pathParam('id', { type: 'string', format: 'uuid' }, 'User ID')
        .build();

      expect(op.parameters).toHaveLength(1);
      expect(op.parameters![0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
      });
    });

    it('should add a Zod query parameter', () => {
      const op = new OperationBuilder()
        .query('limit', z.number().int().min(1).max(100).default(20), 'Items per page')
        .build();

      const param = op.parameters![0];
      expect(param).toMatchObject({ name: 'limit', in: 'query' });
      expect((param as { schema: { type: string; default: number } }).schema.type).toBe('integer');
      expect((param as { schema: { type: string; default: number } }).schema.default).toBe(20);
    });

    it('should add a header parameter', () => {
      const op = new OperationBuilder()
        .header('X-Request-Id', { type: 'string' })
        .build();

      expect(op.parameters![0]).toMatchObject({ name: 'X-Request-Id', in: 'header' });
    });

    it('should replace duplicate parameters', () => {
      const op = new OperationBuilder()
        .query('page', { type: 'integer' })
        .query('page', { type: 'integer', minimum: 1 })
        .build();

      expect(op.parameters).toHaveLength(1);
    });
  });

  describe('request body', () => {
    it('should add a JSON request body', () => {
      const op = new OperationBuilder()
        .body({ type: 'object', properties: { name: { type: 'string' } } })
        .build();

      expect(op.requestBody).toBeDefined();
      expect((op.requestBody as { content: unknown; required: boolean }).required).toBe(true);
    });

    it('should add a Zod request body', () => {
      const op = new OperationBuilder()
        .body(z.object({ name: z.string().min(1) }))
        .build();

      const body = op.requestBody as { content: { 'application/json': { schema: { type: string } } } };
      expect(body.content['application/json'].schema.type).toBe('object');
    });
  });

  describe('responses', () => {
    it('should add a response', () => {
      const op = new OperationBuilder()
        .response(200, { type: 'object' }, 'Success')
        .build();

      expect(op.responses!['200']).toBeDefined();
    });

    it('should add a no-content response', () => {
      const op = new OperationBuilder()
        .noContent(204)
        .build();

      expect(op.responses!['204']).toMatchObject({ description: 'No content' });
      expect((op.responses!['204'] as { content?: unknown }).content).toBeUndefined();
    });

    it('should default to 200 if no responses defined', () => {
      const op = new OperationBuilder().build();
      expect(op.responses!['200']).toBeDefined();
    });

    it('should add Zod schema responses', () => {
      const UserSchema = z.object({ id: z.string().uuid(), name: z.string() });
      const op = new OperationBuilder()
        .response(200, UserSchema, 'User found')
        .build();

      const resp = op.responses!['200'] as { description: string; content: { 'application/json': { schema: { type: string } } } };
      expect(resp.description).toBe('User found');
      expect(resp.content['application/json'].schema.type).toBe('object');
    });
  });

  describe('security', () => {
    it('should add bearer auth', () => {
      const op = new OperationBuilder().bearerAuth().build();
      expect(op.security).toContainEqual({ bearerAuth: [] });
    });

    it('should add no-auth override', () => {
      const op = new OperationBuilder().noAuth().build();
      expect(op.security).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not mutate when chaining', () => {
      const base = new OperationBuilder().summary('Base');
      const withTag = base.tag('Users');

      expect(base.build().tags).toBeUndefined();
      expect(withTag.build().tags).toEqual(['Users']);
    });
  });
});

// ─── Path Helpers ─────────────────────────────────────────────────────────────

describe('path utilities', () => {
  describe('normalizePath', () => {
    it('should convert :param to {param}', () => {
      expect(normalizePath('/users/:id')).toBe('/users/{id}');
    });

    it('should handle multiple params', () => {
      expect(normalizePath('/orgs/:orgId/users/:userId')).toBe('/orgs/{orgId}/users/{userId}');
    });

    it('should leave OpenAPI-style paths unchanged', () => {
      expect(normalizePath('/users/{id}')).toBe('/users/{id}');
    });

    it('should handle paths without params', () => {
      expect(normalizePath('/users')).toBe('/users');
    });
  });

  describe('generateOperationId', () => {
    it('should generate for GET /users', () => {
      expect(generateOperationId('/users', 'get')).toBe('getUsers');
    });

    it('should generate for GET /users/{id}', () => {
      expect(generateOperationId('/users/{id}', 'get')).toBe('getUsersById');
    });

    it('should generate for POST /users', () => {
      expect(generateOperationId('/users', 'post')).toBe('postUsers');
    });

    it('should generate for DELETE /users/{id}/posts/{postId}', () => {
      expect(generateOperationId('/users/{id}/posts/{postId}', 'delete')).toBe(
        'deleteUsersByIdPostsByPostId'
      );
    });
  });
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

describe('validateSpec', () => {
  it('should validate a correct spec', () => {
    const spec = new SpecBuilder()
      .title('Test API')
      .version('1.0.0')
      .server('https://api.example.com')
      .add('/users', 'get', new OperationBuilder().summary('List users'))
      .build();

    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing openapi field', () => {
    const result = validateSpec({ info: { title: 'Test', version: '1.0' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'openapi')).toBe(true);
  });

  it('should detect paths not starting with /', () => {
    const spec = new SpecBuilder()
      .title('API')
      .version('1.0.0')
      .build();

    // Manually inject invalid path
    const invalidSpec = {
      ...spec,
      paths: { 'users': {} },
    };
    const result = validateSpec(invalidSpec);
    expect(result.valid).toBe(false);
  });

  it('should warn when no servers defined', () => {
    const spec = new SpecBuilder().title('API').version('1.0.0').build();
    const result = validateSpec(spec);
    expect(result.warnings.some((w) => w.path === 'servers')).toBe(true);
  });
});

// ─── ComponentsBuilder Tests ───────────────────────────────────────────────────

describe('ComponentsBuilder', () => {
  it('should add a schema', () => {
    const cb = new ComponentsBuilder()
      .schema('User', { type: 'object', properties: { id: { type: 'string' } } })
      .build();

    expect(cb.schemas?.User).toBeDefined();
  });

  it('should add bearer auth', () => {
    const cb = new ComponentsBuilder().bearerAuth().build();
    expect(cb.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('should add API key', () => {
    const cb = new ComponentsBuilder().apiKey('myKey', 'X-My-Key').build();
    expect(cb.securitySchemes?.myKey).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'X-My-Key',
    });
  });

  it('should generate correct $ref strings', () => {
    expect(ComponentsBuilder.schemaRef('User')).toBe('#/components/schemas/User');
    expect(ComponentsBuilder.responseRef('Error')).toBe('#/components/responses/Error');
    expect(ComponentsBuilder.parameterRef('Page')).toBe('#/components/parameters/Page');
  });

  it('should be immutable', () => {
    const base = new ComponentsBuilder();
    const withSchema = base.schema('User', { type: 'object' });

    expect(base.isEmpty()).toBe(true);
    expect(withSchema.isEmpty()).toBe(false);
  });
});

// ─── Full Integration Test ─────────────────────────────────────────────────────

describe('full spec integration', () => {
  it('should build a complete realistic API spec', () => {
    const UserSchema = z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      email: z.string().email(),
      role: z.enum(['admin', 'user', 'guest']),
      createdAt: z.string().datetime(),
    });

    const ErrorSchema = z.object({
      error: z.string(),
      code: z.string().optional(),
    });

    const spec = new SpecBuilder()
      .title('User Management API')
      .version('1.0.0')
      .description('Manages users and their permissions.')
      .server('https://api.example.com', 'Production')
      .server('http://localhost:3000', 'Development')
      .bearerAuth()
      .tag('Users', 'User management')
      .component('User', UserSchema)
      .component('Error', ErrorSchema)
      .add(
        '/users',
        'get',
        new OperationBuilder()
          .summary('List users')
          .tag('Users')
          .query('page', z.number().int().min(1).default(1), 'Page number')
          .query('limit', z.number().int().min(1).max(100).default(20), 'Items per page')
          .response(
            200,
            z.object({ users: z.array(z.object({ id: z.string() })), total: z.number() }),
            'Paginated users'
          )
          .response(401, ErrorSchema, 'Unauthorized')
      )
      .add(
        '/users/:id',
        'get',
        new OperationBuilder()
          .summary('Get user by ID')
          .tag('Users')
          .pathParam('id', z.string().uuid(), 'User ID')
          .response(200, '#/components/schemas/User', 'User found')
          .response(404, ErrorSchema, 'User not found')
      )
      .add(
        '/users',
        'post',
        new OperationBuilder()
          .summary('Create user')
          .tag('Users')
          .body(
            z.object({
              name: z.string().min(1).max(100),
              email: z.string().email(),
              role: z.enum(['admin', 'user', 'guest']).optional(),
            }),
            'User data'
          )
          .response(201, '#/components/schemas/User', 'User created')
          .response(400, ErrorSchema, 'Validation error')
      )
      .add(
        '/users/:id',
        'delete',
        new OperationBuilder()
          .summary('Delete user')
          .tag('Users')
          .pathParam('id', z.string().uuid(), 'User ID')
          .noContent(204)
          .response(404, ErrorSchema, 'User not found')
      )
      .build();

    // Validate structure
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('User Management API');
    expect(spec.servers).toHaveLength(2);
    expect(spec.tags).toHaveLength(1);
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.components?.schemas?.User).toBeDefined();
    expect(spec.components?.schemas?.Error).toBeDefined();
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();

    // Check paths
    expect(spec.paths!['/users']).toBeDefined();
    expect(spec.paths!['/users/{id}']).toBeDefined();

    const listOp = (spec.paths!['/users'] as { get: { parameters: ParameterObject[] } }).get;
    expect(listOp.parameters).toHaveLength(2);

    const getOp = (spec.paths!['/users/{id}'] as { get: { parameters: ParameterObject[] } }).get;
    expect(getOp.parameters).toHaveLength(1);
    expect(getOp.parameters[0].in).toBe('path');

    // Validate the whole spec
    const validation = validateSpec(spec);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

// ─── Types import for linting ──────────────────────────────────────────────────
import type { ParameterObject } from '../src/types/openapi3_1.js';
