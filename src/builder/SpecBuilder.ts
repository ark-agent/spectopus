/**
 * Main OpenAPI 3.1 document builder — the entry point for building specs.
 *
 * SpecBuilder provides a fluent API for constructing complete OpenAPI 3.1
 * documents. It handles path normalization, component registration,
 * security scheme setup, and tag management.
 */

import type {
  OpenAPIDocument,
  InfoObject,
  ServerObject,
  PathsObject,
  PathItemObject,
  OperationObject,
  TagObject,
  SecurityRequirementObject,
  ComponentsObject,
  SecuritySchemeObject,
  HttpMethod,
} from '../types/openapi3_1.js';
import { OperationBuilder } from './OperationBuilder.js';
import { ComponentsBuilder } from './ComponentsBuilder.js';
import { deepMerge } from '../utils/merge.js';
import { assertValidSpec } from '../utils/validate.js';

/**
 * Options for the SpecBuilder constructor.
 */
export interface SpecBuilderOptions {
  /**
   * Whether to auto-generate operationIds from path and method.
   * @default true
   */
  autoOperationId?: boolean;

  /**
   * Whether to validate the spec on build().
   * @default false
   */
  validateOnBuild?: boolean;

  /**
   * OpenAPI version string.
   * @default '3.1.0'
   */
  openApiVersion?: '3.1.0';
}

/**
 * The main OpenAPI 3.1 spec builder.
 *
 * @example
 * ```ts
 * import { SpecBuilder, OperationBuilder } from 'spectopus';
 * import { z } from 'zod';
 *
 * const spec = new SpecBuilder()
 *   .title('My Awesome API')
 *   .version('1.0.0')
 *   .description('Powers the known universe')
 *   .server('https://api.example.com', 'Production')
 *   .bearerAuth()
 *   .add('/users', 'get',
 *     new OperationBuilder()
 *       .summary('List users')
 *       .tag('Users')
 *       .query('page', z.number().int().min(1).default(1), 'Page number')
 *       .response(200, UserSchema, 'Paginated user list')
 *   )
 *   .build();
 * ```
 */
export class SpecBuilder {
  private readonly _info: Partial<InfoObject>;
  private readonly _servers: ServerObject[];
  private readonly _paths: PathsObject;
  private readonly _tags: TagObject[];
  private readonly _globalSecurity: SecurityRequirementObject[];
  private readonly _componentsBuilder: ComponentsBuilder;
  private readonly _options: Required<SpecBuilderOptions>;

  constructor(options: SpecBuilderOptions = {}) {
    this._info = {};
    this._servers = [];
    this._paths = {};
    this._tags = [];
    this._globalSecurity = [];
    this._componentsBuilder = new ComponentsBuilder();
    this._options = {
      autoOperationId: options.autoOperationId ?? true,
      validateOnBuild: options.validateOnBuild ?? false,
      openApiVersion: options.openApiVersion ?? '3.1.0',
    };
  }

  // ─── Info ─────────────────────────────────────────────────────────────────

  /**
   * Set the API title (required).
   */
  title(title: string): SpecBuilder {
    return this._clone({ _info: { ...this._info, title } });
  }

  /**
   * Set the API version string (required).
   * This is your API version, not the OpenAPI version.
   */
  version(version: string): SpecBuilder {
    return this._clone({ _info: { ...this._info, version } });
  }

  /**
   * Set a description for the API (CommonMark / Markdown supported).
   */
  description(description: string): SpecBuilder {
    return this._clone({ _info: { ...this._info, description } });
  }

  /**
   * Set a short summary for the API.
   */
  summary(summary: string): SpecBuilder {
    return this._clone({ _info: { ...this._info, summary } });
  }

  /**
   * Set contact information.
   */
  contact(name: string, email?: string, url?: string): SpecBuilder {
    return this._clone({
      _info: {
        ...this._info,
        contact: { name, ...(email ? { email } : {}), ...(url ? { url } : {}) },
      },
    });
  }

  /**
   * Set license information.
   */
  license(name: string, url?: string): SpecBuilder {
    return this._clone({
      _info: {
        ...this._info,
        license: { name, ...(url ? { url } : {}) },
      },
    });
  }

  /**
   * Set terms of service URL.
   */
  termsOfService(url: string): SpecBuilder {
    return this._clone({ _info: { ...this._info, termsOfService: url } });
  }

  // ─── Servers ──────────────────────────────────────────────────────────────

  /**
   * Add a server to the spec.
   *
   * @param url - Server URL (can include variables like {port})
   * @param description - Optional description
   *
   * @example
   * ```ts
   * builder
   *   .server('https://api.example.com', 'Production')
   *   .server('http://localhost:3000', 'Development')
   * ```
   */
  server(url: string, description?: string): SpecBuilder {
    const s: ServerObject = { url, ...(description ? { description } : {}) };
    return this._clone({ _servers: [...this._servers, s] });
  }

  // ─── Paths ────────────────────────────────────────────────────────────────

  /**
   * Add an operation to the spec.
   *
   * @param path - The URL path (Express-style `:param` syntax supported, converted to `{param}`)
   * @param method - HTTP method
   * @param operation - OperationBuilder or raw OperationObject
   *
   * @example
   * ```ts
   * builder.add('/users/:id', 'get', new OperationBuilder()
   *   .summary('Get user')
   *   .pathParam('id', z.string().uuid())
   *   .response(200, UserSchema)
   * )
   * ```
   */
  add(
    path: string,
    method: HttpMethod,
    operation: OperationBuilder | OperationObject
  ): SpecBuilder {
    // Normalize Express :param syntax to OpenAPI {param}
    const normalizedPath = normalizePath(path);

    const op: OperationObject =
      operation instanceof OperationBuilder
        ? operation.build()
        : (operation as OperationObject);

    // Auto-generate operationId if missing
    if (!op.operationId && this._options.autoOperationId) {
      op.operationId = generateOperationId(normalizedPath, method);
    }

    const currentPathItem = (this._paths[normalizedPath] as PathItemObject | undefined) ?? {};
    const updatedPathItem: PathItemObject = {
      ...currentPathItem,
      [method]: op,
    };

    return this._clone({
      _paths: {
        ...this._paths,
        [normalizedPath]: updatedPathItem,
      },
    });
  }

  /**
   * Add multiple operations at once.
   *
   * @param routes - Array of [path, method, operation] tuples
   */
  addRoutes(
    routes: Array<[string, HttpMethod, OperationBuilder]>
  ): SpecBuilder {
    let builder: SpecBuilder = this;
    for (const [path, method, op] of routes) {
      builder = builder.add(path, method, op);
    }
    return builder;
  }

  /**
   * Merge an entire paths object into the spec.
   */
  paths(paths: PathsObject): SpecBuilder {
    return this._clone({
      _paths: deepMerge(this._paths as Record<string, unknown>, paths as Record<string, unknown>) as PathsObject,
    });
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────

  /**
   * Define a tag with metadata (description, external docs, etc.)
   * Operations can reference tags by name without defining them here,
   * but defining them allows you to add descriptions and control ordering.
   */
  tag(name: string, description?: string): SpecBuilder {
    const existing = this._tags.findIndex((t) => t.name === name);
    const tag: TagObject = {
      name,
      ...(description ? { description } : {}),
    };

    const tags = [...this._tags];
    if (existing >= 0) {
      tags[existing] = tag;
    } else {
      tags.push(tag);
    }

    return this._clone({ _tags: tags });
  }

  // ─── Security ─────────────────────────────────────────────────────────────

  /**
   * Add a Bearer JWT authentication scheme to the components
   * and optionally apply it globally to all operations.
   *
   * @param schemeName - Name of the security scheme (default: 'bearerAuth')
   * @param applyGlobally - Whether to require this auth on all operations (default: true)
   */
  bearerAuth(schemeName = 'bearerAuth', applyGlobally = true): SpecBuilder {
    const cb = this._componentsBuilder.bearerAuth(schemeName);
    const security = applyGlobally
      ? [...this._globalSecurity, { [schemeName]: [] }]
      : this._globalSecurity;

    const builder = this._clone({ _globalSecurity: security });
    (builder as unknown as { _componentsBuilder: ComponentsBuilder })._componentsBuilder = cb;
    return builder;
  }

  /**
   * Add an API key authentication scheme.
   */
  apiKeyAuth(schemeName = 'apiKey', header = 'X-API-Key', applyGlobally = true): SpecBuilder {
    const cb = this._componentsBuilder.apiKey(schemeName, header);
    const security = applyGlobally
      ? [...this._globalSecurity, { [schemeName]: [] }]
      : this._globalSecurity;

    const builder = this._clone({ _globalSecurity: security });
    (builder as unknown as { _componentsBuilder: ComponentsBuilder })._componentsBuilder = cb;
    return builder;
  }

  /**
   * Add a global security requirement.
   */
  security(requirement: SecurityRequirementObject): SpecBuilder {
    return this._clone({ _globalSecurity: [...this._globalSecurity, requirement] });
  }

  // ─── Components ───────────────────────────────────────────────────────────

  /**
   * Add a reusable schema component.
   *
   * @param name - Schema name
   * @param schema - Schema definition
   *
   * @example
   * ```ts
   * builder.component('User', z.object({ id: z.string(), name: z.string() }))
   * // Reference with: '#/components/schemas/User'
   * ```
   */
  component(name: string, schema: import('./SchemaBuilder.js').SchemaInput): SpecBuilder {
    const cb = this._componentsBuilder.schema(name, schema);
    const builder = this._clone({});
    (builder as unknown as { _componentsBuilder: ComponentsBuilder })._componentsBuilder = cb;
    return builder;
  }

  /**
   * Add a security scheme component directly.
   */
  securityScheme(name: string, scheme: SecuritySchemeObject): SpecBuilder {
    const cb = this._componentsBuilder.securityScheme(name, scheme);
    const builder = this._clone({});
    (builder as unknown as { _componentsBuilder: ComponentsBuilder })._componentsBuilder = cb;
    return builder;
  }

  /**
   * Provide a custom ComponentsBuilder.
   */
  components(cb: ComponentsBuilder): SpecBuilder {
    const builder = this._clone({});
    (builder as unknown as { _componentsBuilder: ComponentsBuilder })._componentsBuilder = cb;
    return builder;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * Build and return the final OpenAPI 3.1 document.
   *
   * @throws {Error} if `validateOnBuild` is true and the spec is invalid
   */
  build(): OpenAPIDocument {
    const info = this._buildInfo();
    const doc: OpenAPIDocument = {
      openapi: this._options.openApiVersion,
      info,
    };

    if (this._servers.length > 0) {
      doc.servers = this._servers;
    }

    if (Object.keys(this._paths).length > 0) {
      doc.paths = this._paths;
    }

    const components = this._componentsBuilder.build();
    if (!this._componentsBuilder.isEmpty()) {
      doc.components = components;
    }

    if (this._globalSecurity.length > 0) {
      doc.security = this._globalSecurity;
    }

    if (this._tags.length > 0) {
      doc.tags = this._tags;
    }

    if (this._options.validateOnBuild) {
      assertValidSpec(doc);
    }

    return doc;
  }

  /**
   * Build the spec and return it as a formatted JSON string.
   */
  toJSON(indent = 2): string {
    return JSON.stringify(this.build(), null, indent);
  }

  /**
   * Build the spec and return it as a YAML string.
   * Requires 'js-yaml' or 'yaml' to be installed.
   */
  async toYAML(): Promise<string> {
    const spec = this.build();
    try {
      const { dump } = await import('yaml' as string);
      return (dump as (obj: unknown) => string)(spec);
    } catch {
      try {
        const { dump } = await import('js-yaml' as string);
        return (dump as (obj: unknown) => string)(spec);
      } catch {
        throw new Error(
          'YAML serialization requires either "yaml" or "js-yaml" package. ' +
            'Install one with: npm install yaml'
        );
      }
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private _buildInfo(): InfoObject {
    const { title, version, ...rest } = this._info;

    if (!title) {
      throw new Error('SpecBuilder: title is required. Call .title("Your API Name")');
    }
    if (!version) {
      throw new Error('SpecBuilder: version is required. Call .version("1.0.0")');
    }

    return { title, version, ...rest };
  }

  private _clone(
    updates: Partial<{
      _info: Partial<InfoObject>;
      _servers: ServerObject[];
      _paths: PathsObject;
      _tags: TagObject[];
      _globalSecurity: SecurityRequirementObject[];
    }>
  ): SpecBuilder {
    const builder = new SpecBuilder(this._options);

    Object.assign(builder, {
      _info: { ...this._info },
      _servers: [...this._servers],
      _paths: { ...this._paths },
      _tags: [...this._tags],
      _globalSecurity: [...this._globalSecurity],
      _componentsBuilder: this._componentsBuilder,
    });

    if (updates._info !== undefined) (builder as unknown as { _info: Partial<InfoObject> })._info = updates._info;
    if (updates._servers !== undefined) (builder as unknown as { _servers: ServerObject[] })._servers = updates._servers;
    if (updates._paths !== undefined) (builder as unknown as { _paths: PathsObject })._paths = updates._paths;
    if (updates._tags !== undefined) (builder as unknown as { _tags: TagObject[] })._tags = updates._tags;
    if (updates._globalSecurity !== undefined) (builder as unknown as { _globalSecurity: SecurityRequirementObject[] })._globalSecurity = updates._globalSecurity;

    return builder;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize an Express-style path to OpenAPI path format.
 * ':param' → '{param}'
 */
export function normalizePath(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

/**
 * Generate an operationId from a path and method.
 * e.g., GET /users/{id} → 'getUsersById'
 */
export function generateOperationId(path: string, method: string): string {
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return 'By' + capitalize(part.slice(1, -1));
      }
      return capitalize(part.replace(/[^a-zA-Z0-9]/g, ''));
    });

  return method.toLowerCase() + parts.join('');
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
