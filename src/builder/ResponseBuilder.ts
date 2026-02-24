/**
 * Response builder for OpenAPI 3.1 operation responses.
 */

import type { ResponseObject, SchemaObject, RefOr } from '../types/openapi3_1.js';
import { type SchemaInput } from './SchemaBuilder.js';
import { resolveSchemaInput } from './_zodResolver.js';

/**
 * Fluent builder for OpenAPI 3.1 Response Objects.
 *
 * @example
 * ```ts
 * const response = new ResponseBuilder()
 *   .description('Successful response')
 *   .json({ type: 'object', properties: { id: { type: 'string' } } })
 *   .header('X-Request-Id', { type: 'string' })
 *   .build();
 * ```
 */
export class ResponseBuilder {
  private _description: string;
  private readonly _content: Record<string, { schema?: RefOr<SchemaObject> }>;
  private readonly _headers: Record<string, { schema?: RefOr<SchemaObject>; description?: string }>;

  constructor(description = '') {
    this._description = description;
    this._content = {};
    this._headers = {};
  }

  /**
   * Set the response description.
   */
  description(desc: string): ResponseBuilder {
    const builder = this._clone();
    builder._description = desc;
    return builder;
  }

  /**
   * Add a JSON content type response with the given schema.
   * @param schema - Schema for the response body
   */
  json(schema: SchemaInput): ResponseBuilder {
    return this.content('application/json', schema);
  }

  /**
   * Add a plain text content type response.
   */
  text(schema: SchemaInput = { type: 'string' }): ResponseBuilder {
    return this.content('text/plain', schema);
  }

  /**
   * Add a multipart/form-data content type response.
   */
  formData(schema: SchemaInput): ResponseBuilder {
    return this.content('multipart/form-data', schema);
  }

  /**
   * Add a custom content type response.
   * @param mediaType - MIME type (e.g., 'application/json')
   * @param schema - Schema for the content
   */
  content(mediaType: string, schema: SchemaInput): ResponseBuilder {
    const builder = this._clone();
    const resolvedSchema = resolveSchema(schema);
    builder._content[mediaType] = { schema: resolvedSchema };
    return builder;
  }

  /**
   * Add a response header.
   */
  header(name: string, schema: SchemaInput, description?: string): ResponseBuilder {
    const builder = this._clone();
    const resolvedSchema = resolveSchema(schema);
    builder._headers[name] = {
      schema: resolvedSchema,
      ...(description ? { description } : {}),
    };
    return builder;
  }

  /**
   * Build and return the final ResponseObject.
   */
  build(): ResponseObject {
    const response: ResponseObject = {
      description: this._description || 'Response',
    };

    if (Object.keys(this._content).length > 0) {
      response.content = this._content as ResponseObject['content'];
    }

    if (Object.keys(this._headers).length > 0) {
      response.headers = this._headers as ResponseObject['headers'];
    }

    return response;
  }

  private _clone(): ResponseBuilder {
    const builder = new ResponseBuilder(this._description);
    Object.assign(builder._content, this._content);
    Object.assign(builder._headers, this._headers);
    return builder;
  }
}

// ─── Factory Functions ─────────────────────────────────────────────────────────

/**
 * Build a JSON response with a given schema and description.
 */
export function jsonResponse(
  schema: SchemaInput,
  description = 'Successful response'
): ResponseObject {
  const resolvedSchema = resolveSchema(schema);
  return {
    description,
    content: {
      'application/json': {
        schema: resolvedSchema,
      },
    },
  };
}

/**
 * Build a response for no content (204 etc.)
 */
export function emptyResponse(description = 'No content'): ResponseObject {
  return { description };
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function resolveSchema(schema: SchemaInput): RefOr<SchemaObject> {
  return resolveSchemaInput(schema);
}
