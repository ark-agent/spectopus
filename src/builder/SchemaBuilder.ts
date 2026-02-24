/**
 * Schema composition helpers for building OpenAPI 3.1 schemas.
 *
 * Provides a fluent API for constructing JSON Schema / OpenAPI 3.1 schema objects.
 * Also includes utilities for handling Zod schemas when Zod is available.
 */

import type { SchemaObject, RefOr } from '../types/openapi3_1.js';

// Type alias for schema input — can be a SchemaObject, a $ref string, or a Zod schema
type ZodTypeAny = import('zod').ZodTypeAny;

/**
 * Check if a value looks like a Zod schema object.
 * We use duck-typing to avoid requiring Zod as a hard dependency.
 */
export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as Record<string, unknown>)['parse'] === 'function'
  );
}

/**
 * Convert any supported schema input to an OpenAPI SchemaObject.
 * Supports: SchemaObject, $ref string, or Zod schema (when Zod is available).
 *
 * This is a synchronous operation — zodToOpenAPI itself is a pure function
 * that doesn't require zod to be imported at the point of call.
 */
export { resolveSchemaInput as toSchema } from './_zodResolver.js';
export { resolveSchemaInput as toSchemaSync } from './_zodResolver.js';

/**
 * Types that can be provided as a schema input throughout the builder API.
 * - SchemaObject: A plain OpenAPI 3.1 schema object
 * - string: A $ref path (e.g., '#/components/schemas/User')
 * - ZodTypeAny: A Zod schema (requires zod peer dependency)
 */
export type SchemaInput = SchemaObject | string | ZodTypeAny;

/**
 * Fluent builder for OpenAPI 3.1 Schema Objects.
 *
 * @example
 * ```ts
 * const schema = new SchemaBuilder()
 *   .type('object')
 *   .property('id', { type: 'string', format: 'uuid' }, true)
 *   .property('name', { type: 'string' }, true)
 *   .property('email', { type: 'string', format: 'email' }, true)
 *   .additionalProperties(false)
 *   .build();
 * ```
 */
export class SchemaBuilder {
  private readonly _schema: SchemaObject;

  constructor(initial: SchemaObject = {}) {
    this._schema = { ...initial };
  }

  /**
   * Set the schema type.
   */
  type(type: SchemaObject['type']): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, type });
  }

  /**
   * Set the schema title.
   */
  title(title: string): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, title });
  }

  /**
   * Set the schema description.
   */
  description(description: string): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, description });
  }

  /**
   * Add a property to an object schema.
   * @param name - Property name
   * @param schema - Property schema
   * @param required - Whether the property is required (default: false)
   */
  property(
    name: string,
    schema: RefOr<SchemaObject>,
    required = false
  ): SchemaBuilder {
    const properties = { ...this._schema.properties, [name]: schema };
    const requiredList = [...(this._schema.required ?? [])];
    if (required && !requiredList.includes(name)) {
      requiredList.push(name);
    }
    return new SchemaBuilder({
      ...this._schema,
      properties,
      ...(requiredList.length > 0 ? { required: requiredList } : {}),
    });
  }

  /**
   * Set additional properties for object schemas.
   */
  additionalProperties(value: boolean | RefOr<SchemaObject>): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, additionalProperties: value });
  }

  /**
   * Set items schema for array types.
   */
  items(schema: RefOr<SchemaObject>): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, items: schema });
  }

  /**
   * Set minimum value.
   */
  minimum(value: number): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, minimum: value });
  }

  /**
   * Set maximum value.
   */
  maximum(value: number): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, maximum: value });
  }

  /**
   * Set minimum length.
   */
  minLength(value: number): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, minLength: value });
  }

  /**
   * Set maximum length.
   */
  maxLength(value: number): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, maxLength: value });
  }

  /**
   * Set enum values.
   */
  enum(values: unknown[]): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, enum: values });
  }

  /**
   * Set a default value.
   */
  default(value: unknown): SchemaBuilder {
    return new SchemaBuilder({ ...this._schema, default: value });
  }

  /**
   * Mark as nullable (produces type: ['original', 'null']).
   */
  nullable(): SchemaBuilder {
    const current = this._schema.type;
    if (typeof current === 'string') {
      return new SchemaBuilder({ ...this._schema, type: [current, 'null'] });
    }
    return new SchemaBuilder({
      ...this._schema,
      anyOf: [{ ...this._schema }, { type: 'null' }],
    });
  }

  /**
   * Create a schema using allOf composition.
   */
  static allOf(...schemas: RefOr<SchemaObject>[]): SchemaObject {
    return { allOf: schemas };
  }

  /**
   * Create a schema using anyOf composition.
   */
  static anyOf(...schemas: RefOr<SchemaObject>[]): SchemaObject {
    return { anyOf: schemas };
  }

  /**
   * Create a schema using oneOf composition.
   */
  static oneOf(...schemas: RefOr<SchemaObject>[]): SchemaObject {
    return { oneOf: schemas };
  }

  /**
   * Build and return the final schema object.
   */
  build(): SchemaObject {
    return { ...this._schema };
  }
}

// ─── Common Schema Shortcuts ──────────────────────────────────────────────────

/**
 * Pre-built common schema objects for convenience.
 */
export const schemas = {
  /** UUID string schema */
  uuid: (): SchemaObject => ({ type: 'string', format: 'uuid' }),

  /** Email string schema */
  email: (): SchemaObject => ({ type: 'string', format: 'email' }),

  /** ISO 8601 datetime string schema */
  datetime: (): SchemaObject => ({ type: 'string', format: 'date-time' }),

  /** ISO 8601 date string schema */
  date: (): SchemaObject => ({ type: 'string', format: 'date' }),

  /** URI string schema */
  uri: (): SchemaObject => ({ type: 'string', format: 'uri' }),

  /** Integer schema */
  int: (): SchemaObject => ({ type: 'integer' }),

  /** Positive integer schema */
  positiveInt: (): SchemaObject => ({ type: 'integer', minimum: 1 }),

  /** Standard pagination schema */
  pagination: (): SchemaObject => ({
    type: 'object',
    properties: {
      total: { type: 'integer', description: 'Total number of items' },
      page: { type: 'integer', description: 'Current page number' },
      limit: { type: 'integer', description: 'Items per page' },
      totalPages: { type: 'integer', description: 'Total number of pages' },
    },
    required: ['total', 'page', 'limit'],
  }),

  /** Standard error response schema */
  error: (): SchemaObject => ({
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Error message' },
      code: { type: 'string', description: 'Error code' },
      details: { type: 'object', description: 'Additional error details' },
    },
    required: ['error'],
  }),

  /** Reference to a component schema */
  ref: (name: string): SchemaObject => ({ $ref: `#/components/schemas/${name}` }),
} as const;
