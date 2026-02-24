/**
 * Internal Zod schema resolver.
 * Centralizes Zod → OpenAPI schema conversion in a way that works
 * in both ESM and CJS contexts.
 *
 * @internal
 */

import type { SchemaObject, RefOr } from '../types/openapi3_1.js';
import { zodToOpenAPI } from '../adapters/zod.js';
import { isZodSchema } from './SchemaBuilder.js';

export type SchemaInput = SchemaObject | string | import('zod').ZodTypeAny;

/**
 * Resolve any supported schema input to a RefOr<SchemaObject>.
 * - string → $ref
 * - Zod schema → converted SchemaObject
 * - SchemaObject → passed through
 */
export function resolveSchemaInput(schema: SchemaInput): RefOr<SchemaObject> {
  if (typeof schema === 'string') {
    return { $ref: schema };
  }

  if (isZodSchema(schema)) {
    return zodToOpenAPI(schema as import('zod').ZodSchema);
  }

  return schema as SchemaObject;
}
