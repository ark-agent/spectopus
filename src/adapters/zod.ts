/**
 * Zod → OpenAPI 3.1 schema adapter.
 *
 * Converts Zod schema definitions to OpenAPI 3.1 / JSON Schema 2020-12 compatible
 * schema objects. Supports a wide range of Zod types including:
 * - Primitive types: string, number, integer, boolean, null, undefined
 * - Composite types: object, array, tuple, union, intersection
 * - Modifiers: optional, nullable, readonly
 * - String formats: email, url, uuid, datetime, ip, etc.
 * - Number constraints: min, max, int, multipleOf
 * - String constraints: min, max, regex
 * - Enums: z.enum, z.nativeEnum
 * - Literals: z.literal
 * - Records: z.record
 * - Transformations: z.transform (schema extracted from input)
 * - Default values: z.default
 * - Branded types: treated as underlying type
 */

import type { SchemaObject } from '../types/openapi3_1.js';

// We use dynamic imports so zod is truly optional at runtime
// Type-only import for inference
type ZodTypeAny = import('zod').ZodTypeAny;
type ZodSchema = import('zod').ZodSchema;

/**
 * Options for the Zod → OpenAPI schema conversion.
 */
export interface ZodToOpenAPIOptions {
  /**
   * Whether to include examples from `.describe()` calls.
   * @default true
   */
  includeDescriptions?: boolean;

  /**
   * Whether to include default values.
   * @default true
   */
  includeDefaults?: boolean;

  /**
   * Maximum recursion depth for nested schemas.
   * @default 20
   */
  maxDepth?: number;
}

/**
 * Convert a Zod schema to an OpenAPI 3.1 compatible JSON Schema object.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * import { zodToOpenAPI } from 'spectopus/adapters/zod';
 *
 * const schema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string().min(1).max(100),
 *   age: z.number().int().min(0).optional(),
 * });
 *
 * const openAPISchema = zodToOpenAPI(schema);
 * ```
 */
export function zodToOpenAPI(
  schema: ZodSchema,
  options: ZodToOpenAPIOptions = {}
): SchemaObject {
  const opts: Required<ZodToOpenAPIOptions> = {
    includeDescriptions: options.includeDescriptions ?? true,
    includeDefaults: options.includeDefaults ?? true,
    maxDepth: options.maxDepth ?? 20,
  };

  return convertZodType(schema as ZodTypeAny, opts, 0);
}

/** @internal */
function convertZodType(
  schema: ZodTypeAny,
  opts: Required<ZodToOpenAPIOptions>,
  depth: number
): SchemaObject {
  if (depth > opts.maxDepth) {
    return {};
  }

  // Access internal Zod type name and def
  const typeName: string = schema._def?.typeName ?? '';
  const result: SchemaObject = {};

  // Attach description from .describe()
  if (opts.includeDescriptions && schema._def?.description) {
    result.description = schema._def.description as string;
  }

  switch (typeName) {
    case 'ZodString':
      return { ...result, ...convertZodString(schema, opts) };

    case 'ZodNumber':
      return { ...result, ...convertZodNumber(schema) };

    case 'ZodBigInt':
      return { ...result, type: 'integer', format: 'int64' };

    case 'ZodBoolean':
      return { ...result, type: 'boolean' };

    case 'ZodNull':
      return { ...result, type: 'null' };

    case 'ZodUndefined':
      // undefined is not directly representable in JSON Schema
      return { ...result, not: {} };

    case 'ZodLiteral': {
      const value = schema._def?.value;
      return { ...result, const: value };
    }

    case 'ZodEnum': {
      const values = schema._def?.values as unknown[];
      return { ...result, type: 'string', enum: values };
    }

    case 'ZodNativeEnum': {
      const nativeEnumValues = Object.values(schema._def?.values ?? {}).filter(
        (v) => typeof v !== 'number' || typeof v === 'number'
      );
      // Filter out reverse mappings (numeric enums have both numeric and string keys)
      const stringValues = nativeEnumValues.filter((v) => typeof v === 'string');
      const numValues = nativeEnumValues.filter((v) => typeof v === 'number');
      const values = stringValues.length > 0 ? stringValues : numValues;
      return { ...result, enum: values };
    }

    case 'ZodObject':
      return { ...result, ...convertZodObject(schema, opts, depth) };

    case 'ZodArray':
      return { ...result, ...convertZodArray(schema, opts, depth) };

    case 'ZodTuple':
      return { ...result, ...convertZodTuple(schema, opts, depth) };

    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const options_ = schema._def?.options as ZodTypeAny[];
      return {
        ...result,
        anyOf: options_.map((o) => convertZodType(o, opts, depth + 1)),
      };
    }

    case 'ZodIntersection': {
      const left = convertZodType(schema._def?.left as ZodTypeAny, opts, depth + 1);
      const right = convertZodType(schema._def?.right as ZodTypeAny, opts, depth + 1);
      return { ...result, allOf: [left, right] };
    }

    case 'ZodOptional': {
      const inner = convertZodType(schema._def?.innerType as ZodTypeAny, opts, depth + 1);
      // Optional just means the field can be absent; we return the inner type
      // The "required" handling is done at the object level
      return { ...result, ...inner };
    }

    case 'ZodNullable': {
      const inner = convertZodType(schema._def?.innerType as ZodTypeAny, opts, depth + 1);
      // In JSON Schema 2020-12 / OpenAPI 3.1, use anyOf with null type
      if (inner.type && typeof inner.type === 'string') {
        return { ...result, ...inner, type: [inner.type, 'null'] };
      }
      return {
        ...result,
        anyOf: [inner, { type: 'null' }],
      };
    }

    case 'ZodDefault': {
      const inner = convertZodType(schema._def?.innerType as ZodTypeAny, opts, depth + 1);
      const defaultVal = schema._def?.defaultValue?.() as unknown;
      const out: SchemaObject = { ...result, ...inner };
      if (opts.includeDefaults && defaultVal !== undefined) {
        out.default = defaultVal;
      }
      return out;
    }

    case 'ZodCatch': {
      return convertZodType(schema._def?.innerType as ZodTypeAny, opts, depth + 1);
    }

    case 'ZodBranded': {
      return convertZodType(schema._def?.type as ZodTypeAny, opts, depth + 1);
    }

    case 'ZodReadonly': {
      const inner = convertZodType(schema._def?.innerType as ZodTypeAny, opts, depth + 1);
      return { ...result, ...inner, readOnly: true };
    }

    case 'ZodRecord': {
      const valueSchema = schema._def?.valueType as ZodTypeAny | undefined;
      const out: SchemaObject = { ...result, type: 'object' };
      if (valueSchema) {
        out.additionalProperties = convertZodType(valueSchema, opts, depth + 1);
      } else {
        out.additionalProperties = true;
      }
      return out;
    }

    case 'ZodMap': {
      // Map doesn't have a direct JSON Schema equivalent; represent as object
      return { ...result, type: 'object' };
    }

    case 'ZodSet': {
      const valueSchema = schema._def?.valueType as ZodTypeAny | undefined;
      const out: SchemaObject = { ...result, type: 'array', uniqueItems: true };
      if (valueSchema) {
        out.items = convertZodType(valueSchema, opts, depth + 1);
      }
      return out;
    }

    case 'ZodFunction':
    case 'ZodLazy':
    case 'ZodPromise':
    case 'ZodUnknown':
    case 'ZodAny':
      return { ...result };

    case 'ZodNever':
      return { ...result, not: {} };

    case 'ZodVoid':
      return { ...result, type: 'null' };

    case 'ZodDate':
      return { ...result, type: 'string', format: 'date-time' };

    case 'ZodSymbol':
      return { ...result, type: 'string' };

    case 'ZodPipeline': {
      // Return input schema for pipeline
      return convertZodType(schema._def?.in as ZodTypeAny, opts, depth + 1);
    }

    case 'ZodEffects': {
      // Return input schema for transforms/refinements
      return convertZodType(schema._def?.schema as ZodTypeAny, opts, depth + 1);
    }

    default:
      // Unknown type — return empty schema (accepts anything)
      return { ...result };
  }
}

/** @internal */
function convertZodString(schema: ZodTypeAny, _opts: Required<ZodToOpenAPIOptions>): SchemaObject {
  const result: SchemaObject = { type: 'string' };
  const checks = (schema._def?.checks ?? []) as Array<{ kind: string; value?: unknown; regex?: RegExp; message?: string }>;

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        result.minLength = check.value as number;
        break;
      case 'max':
        result.maxLength = check.value as number;
        break;
      case 'length':
        result.minLength = check.value as number;
        result.maxLength = check.value as number;
        break;
      case 'regex':
        result.pattern = (check.regex as RegExp).source;
        break;
      case 'email':
        result.format = 'email';
        break;
      case 'url':
        result.format = 'uri';
        break;
      case 'uuid':
        result.format = 'uuid';
        break;
      case 'cuid':
      case 'cuid2':
      case 'ulid':
        // No standard format; use pattern-based validation
        break;
      case 'datetime':
        result.format = 'date-time';
        break;
      case 'date':
        result.format = 'date';
        break;
      case 'time':
        result.format = 'time';
        break;
      case 'duration':
        result.format = 'duration';
        break;
      case 'ip':
        // Could be ipv4 or ipv6; use a union in practice
        break;
      case 'emoji':
        break;
      case 'base64':
        result.contentEncoding = 'base64';
        break;
      case 'startsWith':
        result.pattern = `^${escapeRegex(check.value as string)}`;
        break;
      case 'endsWith':
        result.pattern = `${escapeRegex(check.value as string)}$`;
        break;
      case 'includes':
        result.pattern = escapeRegex(check.value as string);
        break;
      case 'toLowerCase':
      case 'toUpperCase':
      case 'trim':
        break;
    }
  }

  return result;
}

/** @internal */
function convertZodNumber(schema: ZodTypeAny): SchemaObject {
  const checks = (schema._def?.checks ?? []) as Array<{ kind: string; value?: unknown; inclusive?: boolean }>;
  let isInteger = false;
  const result: SchemaObject = {};

  for (const check of checks) {
    switch (check.kind) {
      case 'int':
        isInteger = true;
        break;
      case 'min':
        if (check.inclusive) {
          result.minimum = check.value as number;
        } else {
          result.exclusiveMinimum = check.value as number;
        }
        break;
      case 'max':
        if (check.inclusive) {
          result.maximum = check.value as number;
        } else {
          result.exclusiveMaximum = check.value as number;
        }
        break;
      case 'multipleOf':
        result.multipleOf = check.value as number;
        break;
      case 'finite':
        break;
    }
  }

  result.type = isInteger ? 'integer' : 'number';
  return result;
}

/** @internal */
function convertZodObject(
  schema: ZodTypeAny,
  opts: Required<ZodToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const shape = schema._def?.shape?.() as Record<string, ZodTypeAny> | undefined;
  const unknownKeys = schema._def?.unknownKeys as string | undefined;

  const result: SchemaObject = { type: 'object' };
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  if (shape) {
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const isOptional = isZodOptional(fieldSchema);

      // Convert using the unwrapped inner type, then re-attach default if present
      const innerSchema = unwrapZodOptional(fieldSchema);
      const converted = convertZodType(innerSchema, opts, depth + 1);

      // If the wrapper is ZodDefault, the default lives on the wrapper, not the inner type
      const typeName: string = (fieldSchema as ZodTypeAny)._def?.typeName ?? '';
      if (
        opts.includeDefaults &&
        typeName === 'ZodDefault' &&
        converted.default === undefined
      ) {
        const defaultVal = (fieldSchema as ZodTypeAny)._def?.defaultValue?.() as unknown;
        if (defaultVal !== undefined) {
          converted.default = defaultVal;
        }
      }

      properties[key] = converted;
      if (!isOptional) {
        required.push(key);
      }
    }
  }

  if (Object.keys(properties).length > 0) {
    result.properties = properties;
  }

  if (required.length > 0) {
    result.required = required;
  }

  // Handle additionalProperties based on unknown keys setting
  if (unknownKeys === 'strict') {
    result.additionalProperties = false;
  } else if (unknownKeys === 'passthrough') {
    result.additionalProperties = true;
  }

  // Handle catchall
  const catchall = schema._def?.catchall as ZodTypeAny | undefined;
  if (catchall && catchall._def?.typeName !== 'ZodNever') {
    result.additionalProperties = convertZodType(catchall, opts, depth + 1);
  }

  return result;
}

/** @internal */
function convertZodArray(
  schema: ZodTypeAny,
  opts: Required<ZodToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const itemSchema = schema._def?.type as ZodTypeAny | undefined;
  const minLength = schema._def?.minLength?.value as number | undefined;
  const maxLength = schema._def?.maxLength?.value as number | undefined;
  const exactLength = schema._def?.exactLength?.value as number | undefined;

  const result: SchemaObject = { type: 'array' };

  if (itemSchema) {
    result.items = convertZodType(itemSchema, opts, depth + 1);
  }

  if (exactLength !== undefined) {
    result.minItems = exactLength;
    result.maxItems = exactLength;
  } else {
    if (minLength !== undefined) result.minItems = minLength;
    if (maxLength !== undefined) result.maxItems = maxLength;
  }

  return result;
}

/** @internal */
function convertZodTuple(
  schema: ZodTypeAny,
  opts: Required<ZodToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const items = (schema._def?.items ?? []) as ZodTypeAny[];
  const rest = schema._def?.rest as ZodTypeAny | undefined;

  const result: SchemaObject = {
    type: 'array',
    prefixItems: items.map((item) => convertZodType(item, opts, depth + 1)),
  };

  if (rest) {
    result.items = convertZodType(rest, opts, depth + 1);
  } else {
    result.items = false;
  }

  result.minItems = items.length;
  if (!rest) {
    result.maxItems = items.length;
  }

  return result;
}

/** @internal */
function isZodOptional(schema: ZodTypeAny): boolean {
  const typeName: string = schema._def?.typeName ?? '';
  if (typeName === 'ZodOptional') return true;
  if (typeName === 'ZodDefault') return true;
  return false;
}

/** @internal */
function unwrapZodOptional(schema: ZodTypeAny): ZodTypeAny {
  const typeName: string = schema._def?.typeName ?? '';
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    return schema._def?.innerType as ZodTypeAny;
  }
  return schema;
}

/** @internal */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
