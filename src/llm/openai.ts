/**
 * OpenAI function/tool calling adapter.
 *
 * Converts an OpenAPI 3.1 spec into OpenAI-compatible tool definitions
 * suitable for use with the ChatCompletions and Assistants APIs.
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */

import type { OpenAPIDocument, OperationObject, SchemaObject } from '../types/openapi3_1.js';
import { generateOperationId } from '../builder/SpecBuilder.js';

// ─── OpenAI Tool Types ────────────────────────────────────────────────────────

export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters: OpenAIFunctionParameters;
  strict?: boolean;
}

export interface OpenAIFunctionParameters {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

export interface OpenAIToolsOptions {
  /**
   * Whether to enable strict mode (OpenAI structured outputs).
   * When true, additionalProperties is set to false and all params become required.
   * @default false
   */
  strict?: boolean;

  /**
   * Filter operations by tag.
   * Only operations with the specified tag(s) will be included.
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
}

/**
 * Convert an OpenAPI 3.1 document to OpenAI tool definitions.
 *
 * @param doc - The OpenAPI document
 * @param options - Conversion options
 * @returns Array of OpenAI tool definitions
 *
 * @example
 * ```ts
 * import { toLLM } from 'spectopus';
 *
 * const tools = toLLM.openai(spec);
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4o',
 *   messages: [...],
 *   tools,
 * });
 * ```
 */
export function toOpenAITools(
  doc: OpenAPIDocument,
  options: OpenAIToolsOptions = {}
): OpenAITool[] {
  const tools: OpenAITool[] = [];

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

      const tool = operationToOpenAITool(path, method, operation, operationId, options);
      tools.push(tool);

      if (options.limit && tools.length >= options.limit) {
        return tools;
      }
    }
  }

  return tools;
}

function operationToOpenAITool(
  path: string,
  method: string,
  operation: OperationObject,
  operationId: string,
  options: OpenAIToolsOptions
): OpenAITool {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Add path parameters
  const params = operation.parameters ?? [];
  for (const param of params) {
    if ('$ref' in param) continue;

    const schema = param.schema
      ? ('$ref' in param.schema ? { $ref: param.schema.$ref } : cleanSchema(param.schema))
      : {};

    properties[param.name] = {
      ...schema,
      description: param.description,
    };

    if (param.required) {
      required.push(param.name);
    }
  }

  // Add request body fields
  if (operation.requestBody && !('$ref' in operation.requestBody)) {
    const body = operation.requestBody;
    const jsonContent = body.content?.['application/json'];
    if (jsonContent?.schema && !('$ref' in jsonContent.schema)) {
      const bodySchema = jsonContent.schema;
      if (bodySchema.type === 'object' && bodySchema.properties) {
        // Flatten body properties into the function parameters
        for (const [key, propSchema] of Object.entries(bodySchema.properties)) {
          if ('$ref' in propSchema) {
            properties[key] = propSchema;
          } else {
            properties[key] = cleanSchema(propSchema);
          }
        }
        if (bodySchema.required) {
          required.push(...bodySchema.required.filter((r) => !required.includes(r)));
        }
      } else {
        // Non-object body — add as a 'body' parameter
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

  const parameters: OpenAIFunctionParameters = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    parameters.required = required;
  }

  if (options.strict) {
    parameters.additionalProperties = false;
    // In strict mode, all properties must be required
    parameters.required = Object.keys(properties);
  }

  // Build description
  const descParts: string[] = [];
  if (operation.summary) descParts.push(operation.summary);
  if (operation.description && operation.description !== operation.summary) {
    descParts.push(operation.description);
  }
  descParts.push(`[${method.toUpperCase()} ${path}]`);

  const openaiFunction: OpenAIFunction = {
    name: operationId,
    description: descParts.join(' — '),
    parameters,
  };

  if (options.strict) {
    openaiFunction.strict = true;
  }

  return {
    type: 'function',
    function: openaiFunction,
  };
}

/**
 * Clean a schema for LLM consumption — remove unnecessary fields.
 * @internal
 */
export function cleanSchema(schema: SchemaObject): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keepFields = [
    'type', 'format', 'description', 'enum', 'const',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
    'minLength', 'maxLength', 'pattern', 'default',
    'items', 'properties', 'required', 'additionalProperties',
    'allOf', 'anyOf', 'oneOf', 'not',
    '$ref', 'minItems', 'maxItems', 'uniqueItems',
  ];

  for (const field of keepFields) {
    if (field in schema) {
      const val = (schema as Record<string, unknown>)[field];
      if (val !== undefined) {
        result[field] = val;
      }
    }
  }

  return result;
}
