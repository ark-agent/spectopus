/**
 * Tests for the Joi → OpenAPI 3.1 schema adapter.
 */

import { describe, it, expect } from 'vitest';
import Joi from 'joi';
import { joiToOpenAPI, joiDescriptionToOpenAPI } from '../src/adapters/joi.js';
import { isJoiSchema } from '../src/builder/SchemaBuilder.js';
import type { SchemaObject } from '../src/types/openapi3_1.js';

describe('joiToOpenAPI', () => {
  // ─── Primitive Types ─────────────────────────────────────────────────────────

  describe('primitive types', () => {
    it('should convert Joi.string()', () => {
      expect(joiToOpenAPI(Joi.string())).toMatchObject({ type: 'string' });
    });

    it('should convert Joi.number()', () => {
      expect(joiToOpenAPI(Joi.number())).toMatchObject({ type: 'number' });
    });

    it('should convert Joi.boolean()', () => {
      expect(joiToOpenAPI(Joi.boolean())).toMatchObject({ type: 'boolean' });
    });

    it('should convert Joi.date()', () => {
      expect(joiToOpenAPI(Joi.date())).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
    });

    it('should convert Joi.binary()', () => {
      expect(joiToOpenAPI(Joi.binary())).toMatchObject({
        type: 'string',
        contentEncoding: 'base64',
      });
    });

    it('should convert Joi.any() to empty schema', () => {
      expect(joiToOpenAPI(Joi.any())).toEqual({});
    });
  });

  // ─── String Rules ─────────────────────────────────────────────────────────────

  describe('string rules', () => {
    it('should apply min/max length', () => {
      expect(joiToOpenAPI(Joi.string().min(2).max(50))).toMatchObject({
        type: 'string',
        minLength: 2,
        maxLength: 50,
      });
    });

    it('should apply exact length', () => {
      expect(joiToOpenAPI(Joi.string().length(8))).toMatchObject({
        type: 'string',
        minLength: 8,
        maxLength: 8,
      });
    });

    it('should apply email format', () => {
      expect(joiToOpenAPI(Joi.string().email())).toMatchObject({
        type: 'string',
        format: 'email',
      });
    });

    it('should apply uri format', () => {
      expect(joiToOpenAPI(Joi.string().uri())).toMatchObject({
        type: 'string',
        format: 'uri',
      });
    });

    it('should apply uuid format from .guid()', () => {
      expect(joiToOpenAPI(Joi.string().guid())).toMatchObject({
        type: 'string',
        format: 'uuid',
      });
    });

    it('should apply uuid format from .uuid()', () => {
      expect(joiToOpenAPI(Joi.string().uuid())).toMatchObject({
        type: 'string',
        format: 'uuid',
      });
    });

    it('should apply isoDate format', () => {
      expect(joiToOpenAPI(Joi.string().isoDate())).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
    });

    it('should apply hostname format', () => {
      expect(joiToOpenAPI(Joi.string().hostname())).toMatchObject({
        type: 'string',
        format: 'hostname',
      });
    });

    it('should apply pattern from regex', () => {
      const schema = joiToOpenAPI(Joi.string().pattern(/^[A-Z]+$/));
      expect(schema).toMatchObject({ type: 'string', pattern: '^[A-Z]+$' });
    });

    it('should apply alphanum pattern', () => {
      expect(joiToOpenAPI(Joi.string().alphanum())).toMatchObject({
        type: 'string',
        pattern: '^[a-zA-Z0-9]*$',
      });
    });

    it('should apply token pattern', () => {
      expect(joiToOpenAPI(Joi.string().token())).toMatchObject({
        type: 'string',
        pattern: '^[a-zA-Z0-9_]*$',
      });
    });

    it('should apply hex pattern', () => {
      expect(joiToOpenAPI(Joi.string().hex())).toMatchObject({
        type: 'string',
        pattern: '^[a-fA-F0-9]*$',
      });
    });

    it('should apply base64 contentEncoding', () => {
      expect(joiToOpenAPI(Joi.string().base64())).toMatchObject({
        type: 'string',
        contentEncoding: 'base64',
      });
    });
  });

  // ─── Number Rules ─────────────────────────────────────────────────────────────

  describe('number rules', () => {
    it('should apply min/max', () => {
      expect(joiToOpenAPI(Joi.number().min(0).max(100))).toMatchObject({
        type: 'number',
        minimum: 0,
        maximum: 100,
      });
    });

    it('should mark as integer', () => {
      expect(joiToOpenAPI(Joi.number().integer())).toMatchObject({ type: 'integer' });
    });

    it('should apply greater/less as exclusive bounds', () => {
      expect(joiToOpenAPI(Joi.number().greater(0).less(10))).toMatchObject({
        type: 'number',
        exclusiveMinimum: 0,
        exclusiveMaximum: 10,
      });
    });

    it('should apply multiple', () => {
      expect(joiToOpenAPI(Joi.number().multiple(5))).toMatchObject({
        type: 'number',
        multipleOf: 5,
      });
    });

    it('should combine integer + min', () => {
      expect(joiToOpenAPI(Joi.number().integer().min(1))).toMatchObject({
        type: 'integer',
        minimum: 1,
      });
    });
  });

  // ─── Enums ────────────────────────────────────────────────────────────────────

  describe('enums', () => {
    it('should convert Joi.string().valid() to enum', () => {
      expect(joiToOpenAPI(Joi.string().valid('a', 'b', 'c'))).toMatchObject({
        enum: ['a', 'b', 'c'],
      });
    });

    it('should convert Joi.number().valid() to enum', () => {
      expect(joiToOpenAPI(Joi.number().valid(1, 2, 3))).toMatchObject({
        enum: [1, 2, 3],
      });
    });
  });

  // ─── Nullable ─────────────────────────────────────────────────────────────────

  describe('nullable', () => {
    it('should make string nullable with allow(null)', () => {
      const schema = joiToOpenAPI(Joi.string().allow(null));
      expect(schema.type).toContain('null');
      expect(schema.type).toContain('string');
    });

    it('should make number nullable with allow(null)', () => {
      const schema = joiToOpenAPI(Joi.number().allow(null));
      expect(schema.type).toContain('null');
      expect(schema.type).toContain('number');
    });
  });

  // ─── Defaults & Descriptions ──────────────────────────────────────────────────

  describe('defaults and descriptions', () => {
    it('should include default value', () => {
      expect(joiToOpenAPI(Joi.string().default('hello'))).toMatchObject({
        type: 'string',
        default: 'hello',
      });
    });

    it('should include numeric default', () => {
      expect(joiToOpenAPI(Joi.number().default(42))).toMatchObject({
        type: 'number',
        default: 42,
      });
    });

    it('should include description', () => {
      expect(joiToOpenAPI(Joi.string().description('A user name'))).toMatchObject({
        type: 'string',
        description: 'A user name',
      });
    });

    it('should omit defaults when includeDefaults=false', () => {
      const schema = joiToOpenAPI(Joi.string().default('x'), { includeDefaults: false });
      expect(schema.default).toBeUndefined();
    });

    it('should omit descriptions when includeDescriptions=false', () => {
      const schema = joiToOpenAPI(Joi.string().description('test'), { includeDescriptions: false });
      expect(schema.description).toBeUndefined();
    });
  });

  // ─── Objects ──────────────────────────────────────────────────────────────────

  describe('object schemas', () => {
    it('should convert a simple object', () => {
      const schema = joiToOpenAPI(
        Joi.object({
          id: Joi.string().uuid().required(),
          name: Joi.string().min(1).required(),
          age: Joi.number().integer().optional(),
        })
      );

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1 },
          age: { type: 'integer' },
        },
        required: expect.arrayContaining(['id', 'name']),
      });

      expect(schema.required).not.toContain('age');
    });

    it('should not mark optional fields as required', () => {
      const schema = joiToOpenAPI(
        Joi.object({
          a: Joi.string().required(),
          b: Joi.string().optional(),
        })
      );
      expect(schema.required).toEqual(['a']);
    });

    it('should handle nested objects', () => {
      const schema = joiToOpenAPI(
        Joi.object({
          user: Joi.object({
            id: Joi.string().uuid().required(),
          }).required(),
        })
      );

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
            },
          },
        },
      });
    });

    it('should handle empty object', () => {
      expect(joiToOpenAPI(Joi.object())).toMatchObject({ type: 'object' });
    });
  });

  // ─── Arrays ───────────────────────────────────────────────────────────────────

  describe('array schemas', () => {
    it('should convert Joi.array().items(Joi.string())', () => {
      expect(joiToOpenAPI(Joi.array().items(Joi.string()))).toMatchObject({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should convert array with multiple item types as anyOf', () => {
      const schema = joiToOpenAPI(Joi.array().items(Joi.string(), Joi.number()));
      expect(schema).toMatchObject({
        type: 'array',
        items: {
          anyOf: expect.arrayContaining([{ type: 'string' }, { type: 'number' }]),
        },
      });
    });

    it('should apply min/max items', () => {
      expect(joiToOpenAPI(Joi.array().items(Joi.string()).min(1).max(10))).toMatchObject({
        type: 'array',
        minItems: 1,
        maxItems: 10,
      });
    });

    it('should apply exact length', () => {
      expect(joiToOpenAPI(Joi.array().items(Joi.string()).length(3))).toMatchObject({
        type: 'array',
        minItems: 3,
        maxItems: 3,
      });
    });

    it('should apply uniqueItems', () => {
      expect(joiToOpenAPI(Joi.array().items(Joi.string()).unique())).toMatchObject({
        type: 'array',
        uniqueItems: true,
      });
    });

    it('should convert ordered array (tuple)', () => {
      const schema = joiToOpenAPI(
        Joi.array().ordered(Joi.string(), Joi.number(), Joi.boolean())
      );
      expect(schema).toMatchObject({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        minItems: 3,
        maxItems: 3,
      });
    });
  });

  // ─── Alternatives ─────────────────────────────────────────────────────────────

  describe('alternatives schemas', () => {
    it('should convert Joi.alternatives().try() to anyOf', () => {
      const schema = joiToOpenAPI(Joi.alternatives().try(Joi.string(), Joi.number()));
      expect(schema).toMatchObject({
        anyOf: expect.arrayContaining([{ type: 'string' }, { type: 'number' }]),
      });
    });

    it('should handle single alternative as the type itself', () => {
      const schema = joiToOpenAPI(Joi.alternatives().try(Joi.string()));
      expect(schema).toMatchObject({ type: 'string' });
    });
  });

  // ─── Integration ──────────────────────────────────────────────────────────────

  describe('integration: full API schema', () => {
    it('should convert a realistic user creation schema', () => {
      const UserSchema = Joi.object({
        id: Joi.string().uuid().required().description('Unique user ID'),
        name: Joi.string().min(1).max(100).required(),
        email: Joi.string().email().required(),
        age: Joi.number().integer().min(0).max(150).optional(),
        role: Joi.string().valid('admin', 'user', 'guest').default('user').required(),
        tags: Joi.array().items(Joi.string()).optional(),
      });

      const schema = joiToOpenAPI(UserSchema) as SchemaObject & {
        properties: Record<string, SchemaObject>;
        required: string[];
      };

      expect(schema.type).toBe('object');
      expect(schema.properties['id']).toMatchObject({ type: 'string', format: 'uuid' });
      expect(schema.properties['email']).toMatchObject({ type: 'string', format: 'email' });
      expect(schema.properties['age']).toMatchObject({ type: 'integer', minimum: 0, maximum: 150 });
      expect(schema.properties['role']).toMatchObject({ enum: ['admin', 'user', 'guest'], default: 'user' });
      expect(schema.properties['tags']).toMatchObject({ type: 'array', items: { type: 'string' } });
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('email');
      expect(schema.required).not.toContain('age');
      expect(schema.required).not.toContain('tags');
    });
  });

  // ─── joiDescriptionToOpenAPI ──────────────────────────────────────────────────

  describe('joiDescriptionToOpenAPI', () => {
    it('should work with raw describe() output', () => {
      const desc = Joi.string().email().describe();
      const schema = joiDescriptionToOpenAPI(desc);
      expect(schema).toMatchObject({ type: 'string', format: 'email' });
    });

    it('should work with object describe() output', () => {
      const desc = Joi.object({ name: Joi.string().required() }).describe();
      const schema = joiDescriptionToOpenAPI(desc);
      expect(schema).toMatchObject({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      });
    });
  });
});

// ─── isJoiSchema ──────────────────────────────────────────────────────────────

describe('isJoiSchema', () => {
  it('should return true for Joi schemas', () => {
    expect(isJoiSchema(Joi.string())).toBe(true);
    expect(isJoiSchema(Joi.object())).toBe(true);
    expect(isJoiSchema(Joi.array())).toBe(true);
    expect(isJoiSchema(Joi.number())).toBe(true);
  });

  it('should return false for non-Joi values', () => {
    expect(isJoiSchema(null)).toBe(false);
    expect(isJoiSchema(undefined)).toBe(false);
    expect(isJoiSchema('string')).toBe(false);
    expect(isJoiSchema({ type: 'string' })).toBe(false);
    expect(isJoiSchema(42)).toBe(false);
  });
});
