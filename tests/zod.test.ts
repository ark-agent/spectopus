/**
 * Tests for the Zod → OpenAPI 3.1 schema adapter.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToOpenAPI } from '../src/adapters/zod.js';
import type { SchemaObject } from '../src/types/openapi3_1.js';

describe('zodToOpenAPI', () => {
  // ─── Primitive Types ────────────────────────────────────────────────────────

  describe('primitive types', () => {
    it('should convert z.string()', () => {
      const schema = zodToOpenAPI(z.string());
      expect(schema).toMatchObject({ type: 'string' });
    });

    it('should convert z.number()', () => {
      const schema = zodToOpenAPI(z.number());
      expect(schema).toMatchObject({ type: 'number' });
    });

    it('should convert z.boolean()', () => {
      const schema = zodToOpenAPI(z.boolean());
      expect(schema).toMatchObject({ type: 'boolean' });
    });

    it('should convert z.null()', () => {
      const schema = zodToOpenAPI(z.null());
      expect(schema).toMatchObject({ type: 'null' });
    });

    it('should convert z.bigint()', () => {
      const schema = zodToOpenAPI(z.bigint());
      expect(schema).toMatchObject({ type: 'integer', format: 'int64' });
    });

    it('should convert z.date()', () => {
      const schema = zodToOpenAPI(z.date());
      expect(schema).toMatchObject({ type: 'string', format: 'date-time' });
    });

    it('should convert z.any() to empty schema', () => {
      const schema = zodToOpenAPI(z.any());
      expect(schema).toEqual({});
    });

    it('should convert z.unknown() to empty schema', () => {
      const schema = zodToOpenAPI(z.unknown());
      expect(schema).toEqual({});
    });

    it('should convert z.never() to { not: {} }', () => {
      const schema = zodToOpenAPI(z.never());
      expect(schema).toMatchObject({ not: {} });
    });

    it('should convert z.void() to null type', () => {
      const schema = zodToOpenAPI(z.void());
      expect(schema).toMatchObject({ type: 'null' });
    });
  });

  // ─── String Formats ──────────────────────────────────────────────────────────

  describe('string formats', () => {
    it('should convert z.string().email()', () => {
      const schema = zodToOpenAPI(z.string().email());
      expect(schema).toMatchObject({ type: 'string', format: 'email' });
    });

    it('should convert z.string().url()', () => {
      const schema = zodToOpenAPI(z.string().url());
      expect(schema).toMatchObject({ type: 'string', format: 'uri' });
    });

    it('should convert z.string().uuid()', () => {
      const schema = zodToOpenAPI(z.string().uuid());
      expect(schema).toMatchObject({ type: 'string', format: 'uuid' });
    });

    it('should convert z.string().datetime()', () => {
      const schema = zodToOpenAPI(z.string().datetime());
      expect(schema).toMatchObject({ type: 'string', format: 'date-time' });
    });

    it('should convert z.string().date()', () => {
      const schema = zodToOpenAPI(z.string().date());
      expect(schema).toMatchObject({ type: 'string', format: 'date' });
    });

    it('should convert z.string().time()', () => {
      const schema = zodToOpenAPI(z.string().time());
      expect(schema).toMatchObject({ type: 'string', format: 'time' });
    });
  });

  // ─── String Constraints ───────────────────────────────────────────────────────

  describe('string constraints', () => {
    it('should convert min length', () => {
      const schema = zodToOpenAPI(z.string().min(3));
      expect(schema).toMatchObject({ type: 'string', minLength: 3 });
    });

    it('should convert max length', () => {
      const schema = zodToOpenAPI(z.string().max(100));
      expect(schema).toMatchObject({ type: 'string', maxLength: 100 });
    });

    it('should convert regex', () => {
      const schema = zodToOpenAPI(z.string().regex(/^[a-z]+$/));
      expect(schema).toMatchObject({ type: 'string', pattern: '^[a-z]+$' });
    });

    it('should combine min and max', () => {
      const schema = zodToOpenAPI(z.string().min(1).max(255));
      expect(schema).toMatchObject({ type: 'string', minLength: 1, maxLength: 255 });
    });

    it('should convert describe()', () => {
      const schema = zodToOpenAPI(z.string().describe('A name field'));
      expect(schema).toMatchObject({ type: 'string', description: 'A name field' });
    });
  });

  // ─── Number Constraints ───────────────────────────────────────────────────────

  describe('number constraints', () => {
    it('should convert z.number().int()', () => {
      const schema = zodToOpenAPI(z.number().int());
      expect(schema).toMatchObject({ type: 'integer' });
    });

    it('should convert min/max', () => {
      const schema = zodToOpenAPI(z.number().min(1).max(100));
      expect(schema).toMatchObject({ type: 'number', minimum: 1, maximum: 100 });
    });

    it('should convert exclusive min/max', () => {
      const schema = zodToOpenAPI(z.number().gt(0).lt(100));
      expect((schema as SchemaObject & { exclusiveMinimum: number }).exclusiveMinimum).toBe(0);
      expect((schema as SchemaObject & { exclusiveMaximum: number }).exclusiveMaximum).toBe(100);
    });

    it('should convert multipleOf', () => {
      const schema = zodToOpenAPI(z.number().multipleOf(5));
      expect(schema).toMatchObject({ multipleOf: 5 });
    });

    it('should convert int with constraints', () => {
      const schema = zodToOpenAPI(z.number().int().min(1).max(100));
      expect(schema).toMatchObject({ type: 'integer', minimum: 1, maximum: 100 });
    });
  });

  // ─── Literals & Enums ─────────────────────────────────────────────────────────

  describe('literals and enums', () => {
    it('should convert z.literal()', () => {
      const schema = zodToOpenAPI(z.literal('active'));
      expect(schema).toMatchObject({ const: 'active' });
    });

    it('should convert z.literal() with number', () => {
      const schema = zodToOpenAPI(z.literal(42));
      expect(schema).toMatchObject({ const: 42 });
    });

    it('should convert z.enum()', () => {
      const schema = zodToOpenAPI(z.enum(['admin', 'user', 'guest']));
      expect(schema).toMatchObject({
        type: 'string',
        enum: ['admin', 'user', 'guest'],
      });
    });
  });

  // ─── Objects ───────────────────────────────────────────────────────────────────

  describe('objects', () => {
    it('should convert z.object()', () => {
      const schema = zodToOpenAPI(z.object({
        id: z.string(),
        name: z.string(),
      }));

      expect(schema).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      });
    });

    it('should mark optional fields as not required', () => {
      const schema = zodToOpenAPI(z.object({
        id: z.string(),
        bio: z.string().optional(),
      }));

      expect(schema.required).toContain('id');
      expect(schema.required).not.toContain('bio');
    });

    it('should handle nested objects', () => {
      const schema = zodToOpenAPI(z.object({
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      }));

      const addressSchema = (schema.properties as Record<string, SchemaObject>)['address'];
      expect(addressSchema.type).toBe('object');
      expect(addressSchema.properties).toBeDefined();
    });

    it('should handle z.object().strict()', () => {
      const schema = zodToOpenAPI(z.object({ id: z.string() }).strict());
      expect(schema.additionalProperties).toBe(false);
    });

    it('should handle z.object().passthrough()', () => {
      const schema = zodToOpenAPI(z.object({ id: z.string() }).passthrough());
      expect(schema.additionalProperties).toBe(true);
    });
  });

  // ─── Arrays ───────────────────────────────────────────────────────────────────

  describe('arrays', () => {
    it('should convert z.array()', () => {
      const schema = zodToOpenAPI(z.array(z.string()));
      expect(schema).toMatchObject({ type: 'array', items: { type: 'string' } });
    });

    it('should convert min/max items', () => {
      const schema = zodToOpenAPI(z.array(z.string()).min(1).max(10));
      expect(schema).toMatchObject({ minItems: 1, maxItems: 10 });
    });

    it('should convert nested object arrays', () => {
      const schema = zodToOpenAPI(z.array(z.object({ id: z.string() })));
      expect(schema).toMatchObject({
        type: 'array',
        items: { type: 'object' },
      });
    });
  });

  // ─── Tuples ───────────────────────────────────────────────────────────────────

  describe('tuples', () => {
    it('should convert z.tuple()', () => {
      const schema = zodToOpenAPI(z.tuple([z.string(), z.number()]));
      expect(schema).toMatchObject({
        type: 'array',
        minItems: 2,
        maxItems: 2,
      });
      expect(schema.prefixItems).toHaveLength(2);
    });

    it('should handle rest elements', () => {
      const schema = zodToOpenAPI(z.tuple([z.string()]).rest(z.number()));
      expect(schema.items).toMatchObject({ type: 'number' });
    });
  });

  // ─── Unions ───────────────────────────────────────────────────────────────────

  describe('unions', () => {
    it('should convert z.union() to anyOf', () => {
      const schema = zodToOpenAPI(z.union([z.string(), z.number()]));
      expect(schema.anyOf).toHaveLength(2);
    });

    it('should convert z.discriminatedUnion()', () => {
      const schema = zodToOpenAPI(z.discriminatedUnion('type', [
        z.object({ type: z.literal('cat'), name: z.string() }),
        z.object({ type: z.literal('dog'), name: z.string() }),
      ]));
      expect(schema.anyOf).toHaveLength(2);
    });
  });

  // ─── Intersections ────────────────────────────────────────────────────────────

  describe('intersections', () => {
    it('should convert z.intersection() to allOf', () => {
      const A = z.object({ a: z.string() });
      const B = z.object({ b: z.number() });
      const schema = zodToOpenAPI(z.intersection(A, B));
      expect(schema.allOf).toHaveLength(2);
    });
  });

  // ─── Modifiers ────────────────────────────────────────────────────────────────

  describe('modifiers', () => {
    it('should handle z.optional()', () => {
      // Optional just marks field as not required in objects
      // At the schema level, it returns the inner type
      const schema = zodToOpenAPI(z.optional(z.string()));
      expect(schema).toMatchObject({ type: 'string' });
    });

    it('should handle z.nullable()', () => {
      const schema = zodToOpenAPI(z.nullable(z.string()));
      // Should produce string | null
      const types = schema.type;
      const anyOf = schema.anyOf;
      expect(types !== undefined || anyOf !== undefined).toBe(true);
    });

    it('should handle z.default()', () => {
      const schema = zodToOpenAPI(z.string().default('hello'));
      expect(schema).toMatchObject({ type: 'string', default: 'hello' });
    });

    it('should handle z.readonly()', () => {
      const schema = zodToOpenAPI(z.string().readonly());
      expect(schema.readOnly).toBe(true);
    });

    it('should handle z.branded()', () => {
      const Brand = z.string().uuid().brand<'UserId'>();
      const schema = zodToOpenAPI(Brand);
      expect(schema).toMatchObject({ type: 'string', format: 'uuid' });
    });
  });

  // ─── Records ──────────────────────────────────────────────────────────────────

  describe('records', () => {
    it('should convert z.record()', () => {
      const schema = zodToOpenAPI(z.record(z.string()));
      expect(schema).toMatchObject({
        type: 'object',
        additionalProperties: { type: 'string' },
      });
    });

    it('should convert z.record() with unknown value type', () => {
      const schema = zodToOpenAPI(z.record(z.unknown()));
      expect(schema).toMatchObject({ type: 'object' });
    });
  });

  // ─── Sets ────────────────────────────────────────────────────────────────────

  describe('sets', () => {
    it('should convert z.set() to array with uniqueItems', () => {
      const schema = zodToOpenAPI(z.set(z.string()));
      expect(schema).toMatchObject({
        type: 'array',
        uniqueItems: true,
        items: { type: 'string' },
      });
    });
  });

  // ─── Transforms ──────────────────────────────────────────────────────────────

  describe('transforms', () => {
    it('should use input schema for z.transform()', () => {
      const schema = zodToOpenAPI(z.string().transform((s) => s.toUpperCase()));
      expect(schema).toMatchObject({ type: 'string' });
    });

    it('should handle z.preprocess()', () => {
      const schema = zodToOpenAPI(z.preprocess((v) => String(v), z.string()));
      expect(schema).toMatchObject({ type: 'string' });
    });
  });

  // ─── Complex Schemas ─────────────────────────────────────────────────────────

  describe('complex schemas', () => {
    it('should handle a full user schema', () => {
      const UserSchema = z.object({
        id: z.string().uuid().describe('User ID'),
        name: z.string().min(1).max(100).describe('Full name'),
        email: z.string().email(),
        age: z.number().int().min(0).max(150).optional(),
        role: z.enum(['admin', 'user', 'guest']).default('user'),
        metadata: z.record(z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string().length(2),
        }).optional(),
      });

      const schema = zodToOpenAPI(UserSchema);

      expect(schema.type).toBe('object');
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      // role has .default('user') so it's treated as optional at input (not in required[])
      // but it carries a default value in the schema
      expect(schema.required).not.toContain('role');
      expect(schema.required).not.toContain('age');
      expect(schema.required).not.toContain('metadata');

      const props = schema.properties as Record<string, SchemaObject>;
      expect(props['id'].format).toBe('uuid');
      expect(props['id'].description).toBe('User ID');
      expect(props['name'].minLength).toBe(1);
      expect(props['name'].maxLength).toBe(100);
      expect(props['email'].format).toBe('email');
      expect(props['age'].type).toBe('integer');
      // role schema is derived from the inner ZodEnum (default is unwrapped)
      expect(props['role'].enum).toEqual(['admin', 'user', 'guest']);
      expect(props['role'].default).toBe('user'); // default preserved on schema
      expect(props['metadata'].additionalProperties).toBeDefined();
      expect(props['tags'].type).toBe('array');
      expect(props['address'].type).toBe('object');
    });

    it('should handle pagination schema pattern', () => {
      const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
        z.object({
          data: z.array(itemSchema),
          total: z.number().int(),
          page: z.number().int().min(1),
          limit: z.number().int().min(1).max(100),
          totalPages: z.number().int(),
        });

      const UserSchema = z.object({ id: z.string(), name: z.string() });
      const schema = zodToOpenAPI(PaginatedResponseSchema(UserSchema));

      expect(schema.type).toBe('object');
      const props = schema.properties as Record<string, SchemaObject>;
      expect(props['data'].type).toBe('array');
      expect(props['total'].type).toBe('integer');
    });
  });

  // ─── Options ──────────────────────────────────────────────────────────────────

  describe('options', () => {
    it('should respect includeDescriptions: false', () => {
      const schema = zodToOpenAPI(z.string().describe('A string'), { includeDescriptions: false });
      expect(schema.description).toBeUndefined();
    });

    it('should respect includeDefaults: false', () => {
      const schema = zodToOpenAPI(z.string().default('hello'), { includeDefaults: false });
      expect(schema.default).toBeUndefined();
    });
  });
});
