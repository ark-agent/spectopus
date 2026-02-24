/**
 * Query/path/header/cookie parameter builder for OpenAPI 3.1 operations.
 */

import type { ParameterObject, SchemaObject, RefOr } from '../types/openapi3_1.js';
import { type SchemaInput } from './SchemaBuilder.js';
import { resolveSchemaInput } from './_zodResolver.js';

/**
 * Fluent builder for OpenAPI 3.1 Parameter Objects.
 *
 * @example
 * ```ts
 * const param = new ParameterBuilder('page', 'query')
 *   .description('Page number')
 *   .schema({ type: 'integer', minimum: 1, default: 1 })
 *   .required(false)
 *   .build();
 * ```
 */
export class ParameterBuilder {
  private readonly _param: Partial<ParameterObject> & { name: string; in: string };

  constructor(name: string, location: ParameterObject['in']) {
    this._param = { name, in: location };
  }

  /**
   * Set the parameter description.
   */
  description(desc: string): ParameterBuilder {
    return this._clone({ description: desc });
  }

  /**
   * Set whether this parameter is required.
   * Path parameters are always required per the OpenAPI spec.
   */
  required(required: boolean): ParameterBuilder {
    return this._clone({ required });
  }

  /**
   * Mark the parameter as deprecated.
   */
  deprecated(deprecated = true): ParameterBuilder {
    return this._clone({ deprecated });
  }

  /**
   * Set the parameter schema using a raw SchemaObject.
   */
  schema(schema: RefOr<SchemaObject>): ParameterBuilder {
    return this._clone({ schema });
  }

  /**
   * Set an example value for the parameter.
   */
  example(value: unknown): ParameterBuilder {
    return this._clone({ example: value });
  }

  /**
   * Allow empty values (for query parameters).
   */
  allowEmptyValue(allow = true): ParameterBuilder {
    return this._clone({ allowEmptyValue: allow });
  }

  /**
   * Build and return the ParameterObject.
   */
  build(): ParameterObject {
    const { schema: schemaInput, ...rest } = this._param;

    const param: ParameterObject = {
      name: rest.name,
      in: rest.in as ParameterObject['in'],
      ...(rest.description ? { description: rest.description } : {}),
      ...(rest.required !== undefined ? { required: rest.required } : {}),
      ...(rest.deprecated !== undefined ? { deprecated: rest.deprecated } : {}),
      ...(rest.allowEmptyValue !== undefined ? { allowEmptyValue: rest.allowEmptyValue } : {}),
      ...(rest.example !== undefined ? { example: rest.example } : {}),
    };

    // Path params are always required
    if (param.in === 'path') {
      param.required = true;
    }

    if (schemaInput) {
      param.schema = schemaInput as RefOr<SchemaObject>;
    }

    return param;
  }

  private _clone(updates: Partial<ParameterObject>): ParameterBuilder {
    const builder = new ParameterBuilder(
      this._param.name,
      this._param.in as ParameterObject['in']
    );
    Object.assign(builder._param, this._param, updates);
    return builder;
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a query parameter.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * const param = queryParam('page', z.number().int().min(1).default(1), 'Page number');
 * ```
 */
export function queryParam(
  name: string,
  schema: SchemaInput,
  description?: string
): ParameterObject {
  return {
    name,
    in: 'query',
    required: false,
    ...(description ? { description } : {}),
    schema: resolveSchemaInput(schema),
  };
}

/**
 * Create a path parameter (always required).
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * const param = pathParam('id', z.string().uuid(), 'User ID');
 * ```
 */
export function pathParam(
  name: string,
  schema: SchemaInput,
  description?: string
): ParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    ...(description ? { description } : {}),
    schema: resolveSchemaInput(schema),
  };
}

/**
 * Create a header parameter.
 */
export function headerParam(
  name: string,
  schema: SchemaInput,
  description?: string,
  required = false
): ParameterObject {
  return {
    name,
    in: 'header',
    required,
    ...(description ? { description } : {}),
    schema: resolveSchemaInput(schema),
  };
}

/**
 * Create a cookie parameter.
 */
export function cookieParam(
  name: string,
  schema: SchemaInput,
  description?: string,
  required = false
): ParameterObject {
  return {
    name,
    in: 'cookie',
    required,
    ...(description ? { description } : {}),
    schema: resolveSchemaInput(schema),
  };
}
