/**
 * Internal schema resolver.
 * Centralizes schema → OpenAPI conversion in a way that works
 * in both ESM and CJS contexts.
 *
 * Supports Zod schemas, Joi schemas, and plain SchemaObjects.
 *
 * @internal
 */

import type { SchemaObject, RefOr } from '../types/openapi3_1.js';
import { zodToOpenAPI } from '../adapters/zod.js';
import { joiToOpenAPI } from '../adapters/joi.js';
import { isZodSchema, isJoiSchema } from './SchemaBuilder.js';

export type SchemaInput =
  | SchemaObject
  | string
  | import('zod').ZodTypeAny
  | import('../adapters/joi.js').JoiSchema;

/**
 * Resolve any supported schema input to a RefOr<SchemaObject>.
 * - string → $ref
 * - Zod schema → converted SchemaObject via zodToOpenAPI
 * - Joi schema → converted SchemaObject via joiToOpenAPI
 * - SchemaObject → passed through
 */
export function resolveSchemaInput(schema: SchemaInput): RefOr<SchemaObject> {
  if (typeof schema === 'string') {
    return { $ref: schema };
  }

  if (isZodSchema(schema)) {
    return zodToOpenAPI(schema as import('zod').ZodSchema);
  }

  if (isJoiSchema(schema)) {
    return joiToOpenAPI(schema as import('../adapters/joi.js').JoiSchema);
  }

  return schema as SchemaObject;
}
