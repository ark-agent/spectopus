/**
 * Reusable components registry builder for OpenAPI 3.1.
 *
 * Components allow you to define reusable schemas, responses, parameters, etc.
 * and reference them with $ref throughout your spec.
 */

import type {
  ComponentsObject,
  SchemaObject,
  ResponseObject,
  ParameterObject,
  RequestBodyObject,
  SecuritySchemeObject,
  RefOr,
} from '../types/openapi3_1.js';
import { type SchemaInput } from './SchemaBuilder.js';
import { resolveSchemaInput } from './_zodResolver.js';

/**
 * Fluent builder for OpenAPI 3.1 Components Objects.
 *
 * @example
 * ```ts
 * const components = new ComponentsBuilder()
 *   .schema('User', UserZodSchema)
 *   .schema('Error', ErrorZodSchema)
 *   .bearerAuth()
 *   .build();
 * ```
 */
export class ComponentsBuilder {
  private readonly _components: ComponentsObject;

  constructor(initial: ComponentsObject = {}) {
    this._components = { ...initial };
  }

  // ─── Schemas ──────────────────────────────────────────────────────────────

  /**
   * Register a reusable schema component.
   * After registering, reference it with '#/components/schemas/{name}'.
   *
   * @param name - Schema name (used in $ref)
   * @param schema - Schema definition (SchemaObject, Zod schema, or $ref string)
   *
   * @example
   * ```ts
   * components.schema('User', z.object({ id: z.string().uuid(), name: z.string() }))
   * // Now use: { $ref: '#/components/schemas/User' }
   * ```
   */
  schema(name: string, schema: SchemaInput): ComponentsBuilder {
    const resolved = resolveSchema(schema);
    return new ComponentsBuilder({
      ...this._components,
      schemas: {
        ...this._components.schemas,
        [name]: resolved,
      },
    });
  }

  /**
   * Register multiple schemas at once.
   */
  schemas(schemasMap: Record<string, SchemaInput>): ComponentsBuilder {
    let builder: ComponentsBuilder = this;
    for (const [name, schema] of Object.entries(schemasMap)) {
      builder = builder.schema(name, schema);
    }
    return builder;
  }

  // ─── Responses ────────────────────────────────────────────────────────────

  /**
   * Register a reusable response component.
   */
  response(name: string, response: ResponseObject): ComponentsBuilder {
    return new ComponentsBuilder({
      ...this._components,
      responses: {
        ...this._components.responses,
        [name]: response,
      },
    });
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  /**
   * Register a reusable parameter component.
   */
  parameter(name: string, parameter: ParameterObject): ComponentsBuilder {
    return new ComponentsBuilder({
      ...this._components,
      parameters: {
        ...this._components.parameters,
        [name]: parameter,
      },
    });
  }

  // ─── Request Bodies ───────────────────────────────────────────────────────

  /**
   * Register a reusable request body component.
   */
  requestBody(name: string, requestBody: RequestBodyObject): ComponentsBuilder {
    return new ComponentsBuilder({
      ...this._components,
      requestBodies: {
        ...this._components.requestBodies,
        [name]: requestBody,
      },
    });
  }

  // ─── Security Schemes ─────────────────────────────────────────────────────

  /**
   * Register a security scheme component.
   */
  securityScheme(name: string, scheme: SecuritySchemeObject): ComponentsBuilder {
    return new ComponentsBuilder({
      ...this._components,
      securitySchemes: {
        ...this._components.securitySchemes,
        [name]: scheme,
      },
    });
  }

  /**
   * Add a Bearer JWT security scheme with the standard name 'bearerAuth'.
   *
   * @param name - Security scheme name (default: 'bearerAuth')
   * @param bearerFormat - Token format description (default: 'JWT')
   */
  bearerAuth(name = 'bearerAuth', bearerFormat = 'JWT'): ComponentsBuilder {
    return this.securityScheme(name, {
      type: 'http',
      scheme: 'bearer',
      bearerFormat,
      description: `${bearerFormat} authentication token. Pass as 'Authorization: Bearer <token>'.`,
    });
  }

  /**
   * Add an API key security scheme.
   *
   * @param name - Security scheme name (default: 'apiKey')
   * @param header - Header name (default: 'X-API-Key')
   */
  apiKey(name = 'apiKey', header = 'X-API-Key'): ComponentsBuilder {
    return this.securityScheme(name, {
      type: 'apiKey',
      in: 'header',
      name: header,
      description: `API key passed in the '${header}' header.`,
    });
  }

  /**
   * Add Basic HTTP authentication scheme.
   */
  basicAuth(name = 'basicAuth'): ComponentsBuilder {
    return this.securityScheme(name, {
      type: 'http',
      scheme: 'basic',
      description: 'HTTP Basic authentication.',
    });
  }

  /**
   * Add an OAuth2 authorization code flow security scheme.
   */
  oauth2AuthCode(
    name = 'oauth2',
    authorizationUrl: string,
    tokenUrl: string,
    scopes: Record<string, string> = {}
  ): ComponentsBuilder {
    return this.securityScheme(name, {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl,
          tokenUrl,
          scopes,
        },
      },
    });
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * Build and return the final ComponentsObject.
   */
  build(): ComponentsObject {
    return { ...this._components };
  }

  /**
   * Check if there are any components defined.
   */
  isEmpty(): boolean {
    return Object.keys(this._components).length === 0;
  }

  /**
   * Get a $ref string for a component schema by name.
   */
  static schemaRef(name: string): string {
    return `#/components/schemas/${name}`;
  }

  /**
   * Get a $ref string for a component response by name.
   */
  static responseRef(name: string): string {
    return `#/components/responses/${name}`;
  }

  /**
   * Get a $ref string for a component parameter by name.
   */
  static parameterRef(name: string): string {
    return `#/components/parameters/${name}`;
  }
}

// ─── Internal Schema Resolution ───────────────────────────────────────────────

function resolveSchema(schema: SchemaInput): RefOr<SchemaObject> {
  return resolveSchemaInput(schema);
}
