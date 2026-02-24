/**
 * Compact token-efficient LLM representation of an OpenAPI spec.
 *
 * Produces a human-readable, token-minimal text summary of an API spec
 * that you can paste into an LLM system prompt or context window.
 * 
 * Designed to convey maximum API information in minimum tokens.
 */

import type {
  OpenAPIDocument,
  OperationObject,
  SchemaObject,
  ParameterObject,
  ResponseObject,
  RequestBodyObject,
} from '../types/openapi3_1.js';
import { generateOperationId } from '../builder/SpecBuilder.js';

export interface CompactOptions {
  /**
   * Whether to include schema definitions at the end.
   * @default true
   */
  includeSchemas?: boolean;

  /**
   * Whether to include server information.
   * @default true
   */
  includeServers?: boolean;

  /**
   * Whether to include security information.
   * @default true
   */
  includeSecurity?: boolean;

  /**
   * Whether to include parameter descriptions (adds tokens).
   * @default false
   */
  includeParamDescriptions?: boolean;

  /**
   * Filter operations by tag.
   */
  includeTags?: string[];

  /**
   * Max inline depth for schema representation.
   * @default 2
   */
  maxSchemaDepth?: number;
}

/**
 * Generate a compact, token-efficient text summary of an OpenAPI spec.
 *
 * Perfect for injecting API documentation into LLM context windows.
 * Uses a concise custom format that's both human and machine readable.
 *
 * @example
 * ```ts
 * const summary = toLLM.compact(spec);
 * // => 
 * // API: My API v1.0.0
 * // Base: https://api.example.com
 * //
 * // GET /users — List users
 * //   Query: page(int,default:1), limit(int,1-100,default:20)
 * //   → 200: { users: User[], total: int, page: int }
 * //   → 401: { error: string }
 * ```
 */
export function toCompact(
  doc: OpenAPIDocument,
  options: CompactOptions = {}
): string {
  const opts: Required<CompactOptions> = {
    includeSchemas: options.includeSchemas ?? true,
    includeServers: options.includeServers ?? true,
    includeSecurity: options.includeSecurity ?? true,
    includeParamDescriptions: options.includeParamDescriptions ?? false,
    includeTags: options.includeTags ?? [],
    maxSchemaDepth: options.maxSchemaDepth ?? 2,
  };

  const lines: string[] = [];

  // ─── Header ─────────────────────────────────────────────────────────────
  lines.push(`API: ${doc.info.title} v${doc.info.version}`);

  if (doc.info.description) {
    const shortDesc =
      doc.info.description.length > 150
        ? doc.info.description.slice(0, 147) + '...'
        : doc.info.description;
    lines.push(`Desc: ${shortDesc}`);
  }

  // ─── Servers ────────────────────────────────────────────────────────────
  if (opts.includeServers && doc.servers && doc.servers.length > 0) {
    const primaryServer = doc.servers[0];
    lines.push(`Base: ${primaryServer.url}`);
    if (doc.servers.length > 1) {
      const extras = doc.servers.slice(1).map((s) => s.url).join(', ');
      lines.push(`Also: ${extras}`);
    }
  }

  // ─── Security ────────────────────────────────────────────────────────────
  if (opts.includeSecurity && doc.security && doc.security.length > 0) {
    const schemes = doc.security
      .flatMap((s) => Object.keys(s))
      .filter((v, i, a) => a.indexOf(v) === i);

    if (doc.components?.securitySchemes) {
      const schemeDescriptions = schemes.map((name) => {
        const scheme = doc.components?.securitySchemes?.[name];
        if (!scheme || '$ref' in scheme) return name;
        if (scheme.type === 'http' && scheme.scheme === 'bearer') {
          return `Bearer ${scheme.bearerFormat ?? 'token'} (Authorization header)`;
        }
        if (scheme.type === 'apiKey') {
          return `API key (${scheme.in}: ${scheme.name})`;
        }
        return `${name} (${scheme.type})`;
      });
      lines.push(`Auth: ${schemeDescriptions.join('; ')}`);
    } else {
      lines.push(`Auth: ${schemes.join(', ')}`);
    }
  }

  lines.push('');

  // ─── Operations ──────────────────────────────────────────────────────────
  if (doc.paths) {
    // Group by tag for organization
    const tagGroups = new Map<string, Array<[string, string, OperationObject]>>();
    const untagged: Array<[string, string, OperationObject]> = [];

    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;

    for (const [path, pathItem] of Object.entries(doc.paths)) {
      if (!pathItem || '$ref' in pathItem) continue;

      for (const method of methods) {
        const operation = pathItem[method] as OperationObject | undefined;
        if (!operation) continue;

        // Apply tag filter
        if (opts.includeTags.length > 0) {
          const opTags = operation.tags ?? [];
          const hasTag = opts.includeTags.some((t) => opTags.includes(t));
          if (!hasTag) continue;
        }

        const opTags = operation.tags ?? [];
        if (opTags.length === 0) {
          untagged.push([path, method, operation]);
        } else {
          for (const tag of opTags) {
            if (!tagGroups.has(tag)) tagGroups.set(tag, []);
            tagGroups.get(tag)!.push([path, method, operation]);
          }
        }
      }
    }

    // Render tagged groups
    for (const [tag, ops] of tagGroups.entries()) {
      lines.push(`### ${tag}`);
      for (const [path, method, op] of ops) {
        renderOperation(path, method, op, lines, opts);
      }
      lines.push('');
    }

    // Render untagged
    if (untagged.length > 0) {
      for (const [path, method, op] of untagged) {
        renderOperation(path, method, op, lines, opts);
      }
      lines.push('');
    }
  }

  // ─── Component Schemas ───────────────────────────────────────────────────
  if (opts.includeSchemas && doc.components?.schemas) {
    const schemas = doc.components.schemas;
    const schemaEntries = Object.entries(schemas);

    if (schemaEntries.length > 0) {
      lines.push('Schemas:');
      for (const [name, schema] of schemaEntries) {
        if ('$ref' in schema) continue;
        const repr = schemaToCompact(schema, 0, opts.maxSchemaDepth);
        lines.push(`  ${name}: ${repr}`);
      }
    }
  }

  return lines.join('\n').trimEnd();
}

function renderOperation(
  path: string,
  method: string,
  op: OperationObject,
  lines: string[],
  opts: Required<CompactOptions>
): void {
  const methodUpper = method.toUpperCase().padEnd(6);
  const summary = op.summary ? ` — ${op.summary}` : '';
  const deprecated = op.deprecated ? ' [DEPRECATED]' : '';

  lines.push(`${methodUpper} ${path}${summary}${deprecated}`);

  // Path parameters
  const pathParams = (op.parameters ?? []).filter(
    (p): p is ParameterObject => !('$ref' in p) && p.in === 'path'
  );
  if (pathParams.length > 0) {
    const paramStr = pathParams.map((p) => formatParam(p, opts)).join(', ');
    lines.push(`  Path: ${paramStr}`);
  }

  // Query parameters
  const queryParams = (op.parameters ?? []).filter(
    (p): p is ParameterObject => !('$ref' in p) && p.in === 'query'
  );
  if (queryParams.length > 0) {
    const paramStr = queryParams.map((p) => formatParam(p, opts)).join(', ');
    lines.push(`  Query: ${paramStr}`);
  }

  // Header parameters
  const headerParams = (op.parameters ?? []).filter(
    (p): p is ParameterObject => !('$ref' in p) && p.in === 'header'
  );
  if (headerParams.length > 0) {
    const paramStr = headerParams.map((p) => formatParam(p, opts)).join(', ');
    lines.push(`  Headers: ${paramStr}`);
  }

  // Request body
  if (op.requestBody && !('$ref' in op.requestBody)) {
    const bodyRepr = formatRequestBody(op.requestBody, opts.maxSchemaDepth);
    if (bodyRepr) {
      lines.push(`  Body: ${bodyRepr}`);
    }
  }

  // Responses
  if (op.responses) {
    for (const [code, response] of Object.entries(op.responses)) {
      if ('$ref' in response) {
        lines.push(`  → ${code}: $ref`);
        continue;
      }
      const responseRepr = formatResponse(response, opts.maxSchemaDepth);
      lines.push(`  → ${code}: ${responseRepr}`);
    }
  }

  // Auth override (if operation has different security than global)
  if (op.security !== undefined) {
    if (op.security.length === 0) {
      lines.push('  Auth: none (public)');
    } else {
      const schemes = op.security.flatMap((s) => Object.keys(s));
      lines.push(`  Auth: ${schemes.join(', ')}`);
    }
  }
}

function formatParam(param: ParameterObject, opts: Required<CompactOptions>): string {
  const parts: string[] = [param.name];

  if (param.schema && !('$ref' in param.schema)) {
    const schemaStr = schemaToTypeString(param.schema);
    if (schemaStr !== 'any') parts.push(schemaStr);

    if (param.schema.minimum !== undefined && param.schema.maximum !== undefined) {
      parts.push(`${param.schema.minimum}-${param.schema.maximum}`);
    } else if (param.schema.minimum !== undefined) {
      parts.push(`min:${param.schema.minimum}`);
    } else if (param.schema.maximum !== undefined) {
      parts.push(`max:${param.schema.maximum}`);
    }

    if (param.schema.default !== undefined) {
      parts.push(`default:${JSON.stringify(param.schema.default)}`);
    }
  }

  const prefix = param.required ? '' : '?';
  const desc = opts.includeParamDescriptions && param.description ? ` (${param.description})` : '';

  return `${prefix}${parts.join(',')}${desc}`;
}

function formatRequestBody(body: RequestBodyObject, maxDepth: number): string {
  const jsonContent = body.content?.['application/json'];
  if (!jsonContent?.schema) return '';

  if ('$ref' in jsonContent.schema) {
    const ref = (jsonContent.schema as { $ref: string }).$ref;
    const name = ref.split('/').pop() ?? ref;
    return name;
  }

  const repr = schemaToCompact(jsonContent.schema, 0, maxDepth);
  return body.required === false ? `${repr}?` : repr;
}

function formatResponse(response: ResponseObject, maxDepth: number): string {
  if (!response.content) {
    return response.description || 'empty';
  }

  const jsonContent = response.content['application/json'];
  if (!jsonContent?.schema) {
    return response.description || 'empty';
  }

  if ('$ref' in jsonContent.schema) {
    const ref = (jsonContent.schema as { $ref: string }).$ref;
    return ref.split('/').pop() ?? ref;
  }

  return schemaToCompact(jsonContent.schema, 0, maxDepth);
}

/**
 * Produce a compact, human-readable schema representation.
 * e.g., { id: uuid, name: string, email?: email }
 */
function schemaToCompact(
  schema: SchemaObject,
  depth: number,
  maxDepth: number
): string {
  if (depth > maxDepth) return '...';

  if (schema.$ref) {
    const ref = schema.$ref;
    return ref.split('/').pop() ?? ref;
  }

  // Compositions
  if (schema.allOf) {
    const parts = schema.allOf.map((s) => {
      if ('$ref' in s) { const r = (s as { $ref: string }).$ref; return r.split('/').pop() ?? r; }
      return schemaToCompact(s, depth + 1, maxDepth);
    });
    return parts.join(' & ');
  }

  if (schema.anyOf || schema.oneOf) {
    const list = (schema.anyOf ?? schema.oneOf)!;
    const parts = list.map((s) => {
      if ('$ref' in s) { const r = (s as { $ref: string }).$ref; return r.split('/').pop() ?? r; }
      return schemaToCompact(s, depth + 1, maxDepth);
    });
    return parts.join(' | ');
  }

  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  if (schema.const !== undefined) {
    return JSON.stringify(schema.const);
  }

  const type = Array.isArray(schema.type) ? schema.type : schema.type;

  switch (type) {
    case 'object': {
      if (!schema.properties && depth > 0) return 'object';
      if (!schema.properties) return '{}';

      if (depth >= maxDepth) return 'object{...}';

      const requiredSet = new Set(schema.required ?? []);
      const props = Object.entries(schema.properties).map(([key, val]) => {
        const optional = !requiredSet.has(key) ? '?' : '';
        let valStr: string;
        if ('$ref' in val) {
          const r = (val as { $ref: string }).$ref;
          valStr = r.split('/').pop() ?? r;
        } else {
          valStr = schemaToCompact(val, depth + 1, maxDepth);
        }
        return `${key}${optional}: ${valStr}`;
      });

      return `{ ${props.join(', ')} }`;
    }

    case 'array': {
      if (!schema.items) return 'array';
      if ('$ref' in (schema.items as SchemaObject)) {
        const name = (schema.items as { $ref: string }).$ref.split('/').pop() ?? 'item';
        return `${name}[]`;
      }
      const itemType = schemaToCompact(schema.items as SchemaObject, depth + 1, maxDepth);
      return `${itemType}[]`;
    }

    case 'string':
      return schemaToTypeString(schema);

    case 'integer':
      return 'int';

    case 'number':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'null':
      return 'null';

    default: {
      if (Array.isArray(type)) {
        return type.map((t) => t === 'null' ? 'null' : t).join(' | ');
      }
      return 'any';
    }
  }
}

/**
 * Convert a schema to a short type string.
 */
function schemaToTypeString(schema: SchemaObject): string {
  if (schema.format) {
    const formatMap: Record<string, string> = {
      'uuid': 'uuid',
      'email': 'email',
      'date-time': 'datetime',
      'date': 'date',
      'time': 'time',
      'uri': 'uri',
      'ipv4': 'ipv4',
      'ipv6': 'ipv6',
      'int32': 'int32',
      'int64': 'int64',
      'float': 'float',
      'double': 'double',
      'byte': 'base64',
      'binary': 'binary',
      'password': 'password',
    };
    return formatMap[schema.format] ?? schema.format;
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'integer') return 'int';
  return type ?? 'any';
}

// Re-export generateOperationId for use in tests
export { generateOperationId };
