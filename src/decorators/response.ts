/**
 * Response decorators: @Response, @Produces
 *
 * @example
 * ```ts
 * @Get()
 * @Response(200, UserListSchema, 'List of users')
 * @Response(401, ErrorSchema, 'Unauthorized')
 * async listUsers() { ... }
 * ```
 */

import type { SchemaObject, RefOr } from '../types/openapi3_1.js';
import { registerResponse } from './registry.js';
import { resolveSchemaInput } from '../builder/_zodResolver.js';

type SchemaInput = SchemaObject | string | import('zod').ZodTypeAny;

function resolveSchema(schema?: SchemaInput): RefOr<SchemaObject> | undefined {
  if (!schema) return undefined;
  return resolveSchemaInput(schema as SchemaObject | string);
}

// ─── @Response ────────────────────────────────────────────────────────────────

/**
 * Add a response definition to the operation.
 *
 * @param statusCode - HTTP status code
 * @param schema - Response body schema (optional for 204 etc.)
 * @param description - Response description
 * @param mediaType - Content type (default: 'application/json')
 */
export function Response(
  statusCode: number | string,
  schema?: SchemaInput,
  description?: string,
  mediaType = 'application/json'
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerResponse((target as any).constructor, propertyKey, {
      statusCode,
      schema: resolveSchema(schema),
      description: description ?? defaultDescription(statusCode),
      mediaType,
    });
  };
}

/**
 * Add a 200 OK response.
 */
export function Ok(schema?: SchemaInput, description = 'Success'): MethodDecorator {
  return Response(200, schema, description);
}

/**
 * Add a 201 Created response.
 */
export function Created(schema?: SchemaInput, description = 'Created'): MethodDecorator {
  return Response(201, schema, description);
}

/**
 * Add a 204 No Content response.
 */
export function NoContent(description = 'No content'): MethodDecorator {
  return Response(204, undefined, description);
}

/**
 * Add a 400 Bad Request response.
 */
export function BadRequest(schema?: SchemaInput, description = 'Bad request'): MethodDecorator {
  return Response(400, schema, description);
}

/**
 * Add a 401 Unauthorized response.
 */
export function Unauthorized(schema?: SchemaInput, description = 'Unauthorized'): MethodDecorator {
  return Response(401, schema, description);
}

/**
 * Add a 403 Forbidden response.
 */
export function Forbidden(schema?: SchemaInput, description = 'Forbidden'): MethodDecorator {
  return Response(403, schema, description);
}

/**
 * Add a 404 Not Found response.
 */
export function NotFound(schema?: SchemaInput, description = 'Not found'): MethodDecorator {
  return Response(404, schema, description);
}

/**
 * Add a 500 Internal Server Error response.
 */
export function InternalServerError(schema?: SchemaInput, description = 'Internal server error'): MethodDecorator {
  return Response(500, schema, description);
}

// ─── @Produces ────────────────────────────────────────────────────────────────

/**
 * Specify the media type(s) produced by this operation.
 * This is a shorthand for setting content types without a full schema.
 *
 * @param mediaTypes - Content types produced (e.g., 'application/json', 'text/csv')
 */
export function Produces(..._mediaTypes: string[]): MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (_target: object, _propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // This is primarily metadata for documentation; actual response schemas
    // should be provided via @Response
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultDescription(statusCode: number | string): string {
  const descriptions: Record<string, string> = {
    '200': 'Success',
    '201': 'Created',
    '204': 'No Content',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '403': 'Forbidden',
    '404': 'Not Found',
    '422': 'Unprocessable Entity',
    '429': 'Too Many Requests',
    '500': 'Internal Server Error',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    'default': 'Response',
  };
  return descriptions[String(statusCode)] ?? 'Response';
}
