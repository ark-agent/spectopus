/**
 * Operation builder for OpenAPI 3.1 — defines a single HTTP method + path pair.
 *
 * This is the primary builder you'll use to describe each API endpoint.
 * It supports a rich fluent API with Zod schema integration.
 */

import type {
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  RefOr,
  SecurityRequirementObject,
} from '../types/openapi3_1.js';
import { type SchemaInput } from './SchemaBuilder.js';
import { jsonResponse } from './ResponseBuilder.js';
import { resolveSchemaInput } from './_zodResolver.js';

/**
 * Fluent builder for OpenAPI 3.1 Operation Objects.
 *
 * @example
 * ```ts
 * const op = new OperationBuilder()
 *   .summary('Get user by ID')
 *   .description('Fetch a single user by their UUID.')
 *   .tag('Users')
 *   .pathParam('id', z.string().uuid(), 'User ID')
 *   .response(200, UserSchema, 'User found')
 *   .response(404, ErrorSchema, 'User not found')
 *   .bearerAuth();
 * ```
 */
export class OperationBuilder {
  private readonly _op: Partial<OperationObject> & {
    _parameters: ParameterObject[];
    _responses: Record<string, ResponseObject>;
  };

  constructor() {
    this._op = {
      _parameters: [],
      _responses: {},
      tags: [],
    };
  }

  // ─── Identity ──────────────────────────────────────────────────────────────

  /**
   * Set a unique operationId. Must be unique across the entire spec.
   * If not set, spectopus will auto-generate one from the path and method.
   */
  operationId(id: string): OperationBuilder {
    return this._clone({ operationId: id });
  }

  /**
   * Set a short summary for the operation (shown in docs as the title).
   */
  summary(text: string): OperationBuilder {
    return this._clone({ summary: text });
  }

  /**
   * Set a long description (CommonMark / Markdown supported).
   */
  description(text: string): OperationBuilder {
    return this._clone({ description: text });
  }

  /**
   * Add a tag to group this operation in documentation.
   */
  tag(name: string): OperationBuilder {
    const tags = [...(this._op.tags ?? [])];
    if (!tags.includes(name)) tags.push(name);
    return this._clone({ tags });
  }

  /**
   * Add multiple tags at once.
   */
  tags(...names: string[]): OperationBuilder {
    const tags = [...(this._op.tags ?? [])];
    for (const name of names) {
      if (!tags.includes(name)) tags.push(name);
    }
    return this._clone({ tags });
  }

  /**
   * Mark this operation as deprecated.
   */
  deprecated(deprecated = true): OperationBuilder {
    return this._clone({ deprecated });
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  /**
   * Add a query parameter.
   *
   * @param name - Parameter name
   * @param schema - Schema (Zod schema, SchemaObject, or $ref string)
   * @param description - Optional description
   * @param required - Whether the parameter is required (default: false)
   *
   * @example
   * ```ts
   * op.query('page', z.number().int().min(1).default(1), 'Page number')
   * ```
   */
  query(
    name: string,
    schema: SchemaInput,
    description?: string,
    required = false
  ): OperationBuilder {
    const param: ParameterObject = {
      name,
      in: 'query',
      required,
      ...(description ? { description } : {}),
      schema: resolveSchema(schema),
    };
    return this._addParam(param);
  }

  /**
   * Add a required query parameter.
   */
  requiredQuery(name: string, schema: SchemaInput, description?: string): OperationBuilder {
    return this.query(name, schema, description, true);
  }

  /**
   * Add a path parameter (always required per OpenAPI spec).
   *
   * @example
   * ```ts
   * op.pathParam('id', z.string().uuid(), 'User ID')
   * ```
   */
  pathParam(name: string, schema: SchemaInput, description?: string): OperationBuilder {
    const param: ParameterObject = {
      name,
      in: 'path',
      required: true,
      ...(description ? { description } : {}),
      schema: resolveSchema(schema),
    };
    return this._addParam(param);
  }

  /**
   * Add a header parameter.
   */
  header(
    name: string,
    schema: SchemaInput,
    description?: string,
    required = false
  ): OperationBuilder {
    const param: ParameterObject = {
      name,
      in: 'header',
      required,
      ...(description ? { description } : {}),
      schema: resolveSchema(schema),
    };
    return this._addParam(param);
  }

  /**
   * Add a cookie parameter.
   */
  cookie(
    name: string,
    schema: SchemaInput,
    description?: string,
    required = false
  ): OperationBuilder {
    const param: ParameterObject = {
      name,
      in: 'cookie',
      required,
      ...(description ? { description } : {}),
      schema: resolveSchema(schema),
    };
    return this._addParam(param);
  }

  /**
   * Add a raw parameter object directly.
   */
  param(param: ParameterObject): OperationBuilder {
    return this._addParam(param);
  }

  // ─── Request Body ─────────────────────────────────────────────────────────

  /**
   * Set the request body with a JSON schema.
   *
   * @param schema - Body schema (Zod schema, SchemaObject, or $ref string)
   * @param description - Optional description
   * @param required - Whether the body is required (default: true)
   *
   * @example
   * ```ts
   * op.body(CreateUserSchema, 'User to create')
   * ```
   */
  body(schema: SchemaInput, description?: string, required = true): OperationBuilder {
    return this.bodyContent('application/json', schema, description, required);
  }

  /**
   * Set the request body with a specific media type.
   */
  bodyContent(
    mediaType: string,
    schema: SchemaInput,
    description?: string,
    required = true
  ): OperationBuilder {
    const requestBody: RequestBodyObject = {
      required,
      ...(description ? { description } : {}),
      content: {
        [mediaType]: {
          schema: resolveSchema(schema),
        },
      },
    };
    return this._clone({ requestBody });
  }

  /**
   * Set the request body with form data schema.
   */
  formBody(schema: SchemaInput, description?: string, required = true): OperationBuilder {
    return this.bodyContent('multipart/form-data', schema, description, required);
  }

  /**
   * Set a raw request body object.
   */
  requestBody(body: RequestBodyObject): OperationBuilder {
    return this._clone({ requestBody: body });
  }

  // ─── Responses ────────────────────────────────────────────────────────────

  /**
   * Add a response for a given HTTP status code.
   *
   * @param statusCode - HTTP status code (e.g., 200, 404) or 'default'
   * @param schema - Response body schema (Zod schema, SchemaObject, or $ref string)
   * @param description - Response description
   *
   * @example
   * ```ts
   * op
   *   .response(200, UserSchema, 'User found')
   *   .response(404, ErrorSchema, 'Not found')
   * ```
   */
  response(
    statusCode: number | 'default',
    schema: SchemaInput,
    description = 'Response'
  ): OperationBuilder {
    const responseObj = jsonResponse(schema, description);
    const responses = { ...this._op._responses, [String(statusCode)]: responseObj };
    const builder = this._clone({});
    builder._op._responses = responses;
    return builder;
  }

  /**
   * Add a response with no body (e.g., 204 No Content).
   */
  noContent(statusCode: number | 'default' = 204, description = 'No content'): OperationBuilder {
    const responseObj: ResponseObject = { description };
    const responses = { ...this._op._responses, [String(statusCode)]: responseObj };
    const builder = this._clone({});
    builder._op._responses = responses;
    return builder;
  }

  /**
   * Add a raw response object.
   */
  rawResponse(
    statusCode: number | 'default',
    response: ResponseObject
  ): OperationBuilder {
    const responses = { ...this._op._responses, [String(statusCode)]: response };
    const builder = this._clone({});
    builder._op._responses = responses;
    return builder;
  }

  // ─── Security ─────────────────────────────────────────────────────────────

  /**
   * Require Bearer JWT authentication for this operation.
   */
  bearerAuth(schemeName = 'bearerAuth'): OperationBuilder {
    return this.security({ [schemeName]: [] });
  }

  /**
   * Require API key authentication for this operation.
   */
  apiKeyAuth(schemeName = 'apiKey'): OperationBuilder {
    return this.security({ [schemeName]: [] });
  }

  /**
   * Require OAuth2 scopes for this operation.
   */
  oauth2(schemeName = 'oauth2', ...scopes: string[]): OperationBuilder {
    return this.security({ [schemeName]: scopes });
  }

  /**
   * Mark the operation as not requiring authentication (overrides global security).
   */
  noAuth(): OperationBuilder {
    return this._clone({ security: [] });
  }

  /**
   * Add a security requirement.
   */
  security(requirement: SecurityRequirementObject): OperationBuilder {
    const current = this._op.security ?? [];
    return this._clone({ security: [...current, requirement] });
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * Build and return the final OperationObject.
   */
  build(): OperationObject {
    const {
      _parameters: parameters,
      _responses: responsesMap,
      tags,
      ...rest
    } = this._op;

    const operation: OperationObject = { ...rest };

    if (tags && tags.length > 0) {
      operation.tags = tags;
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (Object.keys(responsesMap).length > 0) {
      operation.responses = responsesMap;
    } else {
      // OpenAPI requires at least one response
      operation.responses = {
        '200': { description: 'Successful response' },
      };
    }

    return operation;
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private _addParam(param: ParameterObject): OperationBuilder {
    const builder = this._clone({});
    // Replace if same name+location already exists
    const existing = builder._op._parameters.findIndex(
      (p) => p.name === param.name && p.in === param.in
    );
    if (existing >= 0) {
      builder._op._parameters[existing] = param;
    } else {
      builder._op._parameters.push(param);
    }
    return builder;
  }

  private _clone(updates: Partial<OperationObject>): OperationBuilder {
    const builder = new OperationBuilder();
    Object.assign(builder._op, this._op, updates);
    builder._op._parameters = [...this._op._parameters];
    builder._op._responses = { ...this._op._responses };
    return builder;
  }
}

// ─── Internal Schema Resolution ───────────────────────────────────────────────

function resolveSchema(schema: SchemaInput): RefOr<SchemaObject> {
  return resolveSchemaInput(schema);
}
