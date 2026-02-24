/**
 * Anthropic tool use adapter.
 *
 * Converts an OpenAPI 3.1 spec into Anthropic-compatible tool definitions
 * suitable for use with Claude's tool use feature.
 *
 * @see https://docs.anthropic.com/claude/docs/tool-use
 */

import type { OpenAPIDocument, OperationObject, SchemaObject } from '../types/openapi3_1.js';
import { generateOperationId } from '../builder/SpecBuilder.js';
import { cleanSchema } from './openai.js';

// ─── Anthropic Tool Types ─────────────────────────────────────────────────────

export interface AnthropicToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicToolInputSchema;
}

export interface AnthropicToolsOptions {
  /**
   * Filter operations by tag.
   */
  includeTags?: string[];

  /**
   * Operations to exclude by operationId.
   */
  excludeOperations?: string[];

  /**
   * Maximum number of tools to include (defaults to all).
   */
  limit?: number;

  /**
   * Whether to include the HTTP method and path in the description.
   * @default true
   */
  includePathInDescription?: boolean;
}

/**
 * Convert an OpenAPI 3.1 document to Anthropic tool definitions.
 *
 * @param doc - The OpenAPI document
 * @param options - Conversion options
 * @returns Array of Anthropic tool definitions
 *
 * @example
 * ```ts
 * import { toLLM } from 'spectopus';
 *
 * const tools = toLLM.anthropic(spec);
 * const response = await anthropic.messages.create({
 *   model: 'claude-opus-4-5',
 *   messages: [...],
 *   tools,
 * });
 * ```
 */
export function toAnthropicTools(
  doc: OpenAPIDocument,
  options: AnthropicToolsOptions = {}
): AnthropicTool[] {
  const tools: AnthropicTool[] = [];
  const includePathInDescription = options.includePathInDescription ?? true;

  if (!doc.paths) return tools;

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem || '$ref' in pathItem) continue;

    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'] as const;

    for (const method of methods) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;

      // Apply tag filter
      if (options.includeTags && options.includeTags.length > 0) {
        const opTags = operation.tags ?? [];
        const hasTag = options.includeTags.some((t) => opTags.includes(t));
        if (!hasTag) continue;
      }

      const operationId =
        operation.operationId ?? generateOperationId(path, method);

      // Apply exclusion filter
      if (options.excludeOperations?.includes(operationId)) continue;

      const tool = operationToAnthropicTool(
        path,
        method,
        operation,
        operationId,
        includePathInDescription
      );
      tools.push(tool);

      if (options.limit && tools.length >= options.limit) {
        return tools;
      }
    }
  }

  return tools;
}

function operationToAnthropicTool(
  path: string,
  method: string,
  operation: OperationObject,
  operationId: string,
  includePathInDescription: boolean
): AnthropicTool {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Add parameters (query, path, header, cookie)
  const params = operation.parameters ?? [];
  for (const param of params) {
    if ('$ref' in param) continue;

    const schema = param.schema
      ? '$ref' in param.schema
        ? { $ref: param.schema.$ref }
        : cleanSchema(param.schema)
      : {};

    properties[param.name] = {
      ...schema,
      description: buildParamDescription(param.name, param.in, param.description),
    };

    if (param.required) {
      required.push(param.name);
    }
  }

  // Add request body
  if (operation.requestBody && !('$ref' in operation.requestBody)) {
    const body = operation.requestBody;
    const jsonContent = body.content?.['application/json'];

    if (jsonContent?.schema && !('$ref' in jsonContent.schema)) {
      const bodySchema = jsonContent.schema;

      if (bodySchema.type === 'object' && bodySchema.properties) {
        // Flatten body properties
        for (const [key, propSchema] of Object.entries(bodySchema.properties)) {
          if ('$ref' in propSchema) {
            properties[key] = propSchema;
          } else {
            properties[key] = cleanSchema(propSchema as SchemaObject);
          }
        }
        if (bodySchema.required) {
          required.push(...bodySchema.required.filter((r) => !required.includes(r)));
        }
      } else {
        properties['body'] = {
          ...cleanSchema(bodySchema as SchemaObject),
          description: body.description ?? 'Request body',
        };
        if (body.required) {
          required.push('body');
        }
      }
    }
  }

  // Build description
  const descParts: string[] = [];

  if (operation.summary) {
    descParts.push(operation.summary);
  }

  if (operation.description && operation.description !== operation.summary) {
    // Keep description concise for LLMs
    const truncated =
      operation.description.length > 200
        ? operation.description.slice(0, 197) + '...'
        : operation.description;
    descParts.push(truncated);
  }

  if (includePathInDescription) {
    descParts.push(`Endpoint: ${method.toUpperCase()} ${path}`);
  }

  // Add tag info for context
  if (operation.tags && operation.tags.length > 0) {
    descParts.push(`Category: ${operation.tags.join(', ')}`);
  }

  const inputSchema: AnthropicToolInputSchema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    inputSchema.required = required;
  }

  return {
    name: operationId,
    description: descParts.join('. ') || `${method.toUpperCase()} ${path}`,
    input_schema: inputSchema,
  };
}

function buildParamDescription(
  name: string,
  location: string,
  description?: string
): string {
  const locationNote =
    location !== 'query' ? ` (${location} parameter)` : '';
  return description
    ? `${description}${locationNote}`
    : `${name}${locationNote}`;
}
