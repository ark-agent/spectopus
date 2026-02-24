/**
 * Parameter decorators: @Query, @Path, @Header, @Cookie, @Body
 *
 * @example
 * ```ts
 * @Get('/:id')
 * @Path('id', z.string().uuid(), 'User ID')
 * @Query('include', z.string().optional(), 'Fields to include')
 * async getById() { ... }
 * ```
 */

import type { SchemaObject, RefOr } from '../types/openapi3_1.js';
import { registerParameter, registerBody } from './registry.js';
import { resolveSchemaInput } from '../builder/_zodResolver.js';

type SchemaInput = SchemaObject | string | import('zod').ZodTypeAny;

function resolveSchema(schema: SchemaInput): RefOr<SchemaObject> {
  return resolveSchemaInput(schema as SchemaObject | string);
}

// ─── @Query ───────────────────────────────────────────────────────────────────

/**
 * Declare a query parameter for the operation.
 *
 * @param name - Parameter name
 * @param schema - Parameter schema
 * @param description - Optional description
 * @param required - Whether the parameter is required (default: false)
 */
export function Query(
  name: string,
  schema: SchemaInput,
  description?: string,
  required = false
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerParameter((target as any).constructor, propertyKey, {
      name,
      in: 'query',
      schema: resolveSchema(schema),
      description,
      required,
    });
  };
}

// ─── @Path ────────────────────────────────────────────────────────────────────

/**
 * Declare a path parameter for the operation.
 * Path parameters are always required.
 *
 * @param name - Parameter name (must match the {name} in the route path)
 * @param schema - Parameter schema
 * @param description - Optional description
 */
export function Path(
  name: string,
  schema: SchemaInput,
  description?: string
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerParameter((target as any).constructor, propertyKey, {
      name,
      in: 'path',
      schema: resolveSchema(schema),
      description,
      required: true,
    });
  };
}

// Alias for @Path
export const PathParam = Path;

// ─── @Header ──────────────────────────────────────────────────────────────────

/**
 * Declare a header parameter for the operation.
 *
 * @param name - Header name
 * @param schema - Parameter schema
 * @param description - Optional description
 * @param required - Whether the header is required (default: false)
 */
export function Header(
  name: string,
  schema: SchemaInput,
  description?: string,
  required = false
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerParameter((target as any).constructor, propertyKey, {
      name,
      in: 'header',
      schema: resolveSchema(schema),
      description,
      required,
    });
  };
}

// ─── @Cookie ──────────────────────────────────────────────────────────────────

/**
 * Declare a cookie parameter for the operation.
 *
 * @param name - Cookie name
 * @param schema - Parameter schema
 * @param description - Optional description
 * @param required - Whether the cookie is required (default: false)
 */
export function Cookie(
  name: string,
  schema: SchemaInput,
  description?: string,
  required = false
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerParameter((target as any).constructor, propertyKey, {
      name,
      in: 'cookie',
      schema: resolveSchema(schema),
      description,
      required,
    });
  };
}

// ─── @Body ────────────────────────────────────────────────────────────────────

/**
 * Declare the request body schema for the operation.
 *
 * @param schema - Body schema
 * @param description - Optional description
 * @param required - Whether the body is required (default: true)
 * @param mediaType - Content type (default: 'application/json')
 */
export function Body(
  schema: SchemaInput,
  description?: string,
  required = true,
  mediaType = 'application/json'
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerBody((target as any).constructor, propertyKey, {
      schema: resolveSchema(schema),
      description,
      required,
      mediaType,
    });
  };
}
