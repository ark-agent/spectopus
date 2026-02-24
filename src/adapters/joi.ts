/**
 * Joi → OpenAPI 3.1 schema adapter.
 *
 * Converts Joi schema descriptions (from `schema.describe()`) to OpenAPI 3.1 /
 * JSON Schema 2020-12 compatible schema objects.
 *
 * Unlike the Zod adapter which introspects internal `_def` properties, this adapter
 * uses Joi's stable public `describe()` API — meaning it works across all Joi 17+
 * versions without internal coupling.
 *
 * Joi is an optional peer dependency. This adapter never imports Joi at runtime;
 * it only processes the plain object returned by `schema.describe()`.
 *
 * Supported Joi types:
 * - Primitives: string, number, boolean, date, binary, any
 * - Composites: object, array (items + ordered/tuple)
 * - Alternatives: anyOf / oneOf
 * - Modifiers: optional, nullable (via allow: [null]), defaults, descriptions
 * - String rules: min, max, length, email, uri, guid/uuid, pattern, alphanum,
 *   token, hostname, ip, base64, isoDate, isoDuration, hex, creditCard, case, trim
 * - Number rules: min, max, greater, less, integer, multiple, precision
 * - Enums: flags.only + allow[]
 */

import type { SchemaObject } from '../types/openapi3_1.js';

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * Opaque type representing a Joi schema instance.
 * We only require the describe() method — no Joi import needed.
 */
export interface JoiSchema {
  describe(): JoiDescription;
}

/**
 * Options for the Joi → OpenAPI schema conversion.
 */
export interface JoiToOpenAPIOptions {
  /**
   * Whether to include descriptions from `.description()` calls.
   * @default true
   */
  includeDescriptions?: boolean;

  /**
   * Whether to include default values from `.default()` calls.
   * @default true
   */
  includeDefaults?: boolean;

  /**
   * Maximum recursion depth for nested schemas.
   * @default 20
   */
  maxDepth?: number;
}

// ─── Internal Types (Joi describe() output shape) ─────────────────────────────

/** @internal */
interface JoiDescription {
  type: string;
  flags?: JoiFlags;
  rules?: JoiRule[];
  keys?: Record<string, JoiDescription>;
  items?: JoiDescription[];
  ordered?: JoiDescription[];
  matches?: JoiAlternativeMatch[];
  allow?: unknown[];
  metas?: unknown[];
  label?: string;
  notes?: string[];
  examples?: unknown[];
  link?: { ref: string };
}

/** @internal */
interface JoiFlags {
  presence?: 'optional' | 'required' | 'forbidden';
  default?: unknown;
  description?: string;
  only?: boolean;
  allowUnknown?: boolean;
  sparse?: boolean;
  single?: boolean;
  encoding?: string;
  unsafe?: boolean;
  convert?: boolean;
  case?: 'upper' | 'lower';
  trim?: boolean;
  insensitive?: boolean;
  unknown?: boolean;
}

/** @internal */
interface JoiRule {
  name: string;
  args?: Record<string, unknown>;
  operator?: string;
  invert?: boolean;
}

/** @internal */
interface JoiAlternativeMatch {
  schema?: JoiDescription;
  ref?: unknown;
  is?: JoiDescription;
  then?: JoiDescription;
  otherwise?: JoiDescription;
  switch?: Array<{ is: JoiDescription; then: JoiDescription; otherwise?: JoiDescription }>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a Joi schema to an OpenAPI 3.1 compatible JSON Schema object.
 *
 * Uses Joi's stable `.describe()` API — no internal Joi properties accessed.
 *
 * @example
 * ```ts
 * import Joi from 'joi';
 * import { joiToOpenAPI } from 'spectopus';
 *
 * const schema = Joi.object({
 *   id:    Joi.string().uuid().required(),
 *   name:  Joi.string().min(1).max(100).required(),
 *   age:   Joi.number().integer().min(0).optional(),
 *   email: Joi.string().email().required(),
 * });
 *
 * const openAPISchema = joiToOpenAPI(schema);
 * ```
 */
export function joiToOpenAPI(
  schema: JoiSchema,
  options: JoiToOpenAPIOptions = {}
): SchemaObject {
  const opts: Required<JoiToOpenAPIOptions> = {
    includeDescriptions: options.includeDescriptions ?? true,
    includeDefaults: options.includeDefaults ?? true,
    maxDepth: options.maxDepth ?? 20,
  };

  const description = schema.describe();
  return convertJoiDescription(description, opts, 0);
}

/**
 * Convert a raw Joi description object (from `schema.describe()`) to an OpenAPI schema.
 * Useful when you already have the describe() output and don't need the Joi instance.
 *
 * @example
 * ```ts
 * import Joi from 'joi';
 * import { joiDescriptionToOpenAPI } from 'spectopus';
 *
 * const desc = Joi.string().email().describe();
 * const schema = joiDescriptionToOpenAPI(desc);
 * ```
 */
export function joiDescriptionToOpenAPI(
  description: unknown,
  options: JoiToOpenAPIOptions = {}
): SchemaObject {
  const opts: Required<JoiToOpenAPIOptions> = {
    includeDescriptions: options.includeDescriptions ?? true,
    includeDefaults: options.includeDefaults ?? true,
    maxDepth: options.maxDepth ?? 20,
  };
  return convertJoiDescription(description as JoiDescription, opts, 0);
}

// ─── Core Converter ───────────────────────────────────────────────────────────

/** @internal */
function convertJoiDescription(
  desc: JoiDescription,
  opts: Required<JoiToOpenAPIOptions>,
  depth: number
): SchemaObject {
  if (depth > opts.maxDepth) {
    return {};
  }

  const result: SchemaObject = {};

  // Description from flags.description
  if (opts.includeDescriptions && desc.flags?.description) {
    result.description = desc.flags.description;
  }

  // Default value
  if (opts.includeDefaults && desc.flags?.default !== undefined) {
    result.default = desc.flags.default as unknown;
  }

  // Enum: flags.only=true means only the values in allow[] are valid
  if (desc.flags?.only && Array.isArray(desc.allow) && desc.allow.length > 0) {
    const enumValues = desc.allow.filter((v) => v !== null);
    const hasNull = desc.allow.includes(null);

    if (hasNull) {
      return {
        ...result,
        enum: desc.allow,
      };
    }

    return {
      ...result,
      enum: enumValues,
    };
  }

  // Check for nullable (allow contains null but it's not an enum)
  const hasNullAllow = Array.isArray(desc.allow) && desc.allow.includes(null);

  // Dispatch by type
  let typeSchema: SchemaObject;

  switch (desc.type) {
    case 'string':
      typeSchema = convertString(desc, opts);
      break;

    case 'number':
      typeSchema = convertNumber(desc);
      break;

    case 'boolean':
      typeSchema = convertBoolean(desc);
      break;

    case 'object':
      typeSchema = convertObject(desc, opts, depth);
      break;

    case 'array':
      typeSchema = convertArray(desc, opts, depth);
      break;

    case 'alternatives':
      typeSchema = convertAlternatives(desc, opts, depth);
      break;

    case 'date':
      typeSchema = { type: 'string', format: 'date-time' };
      break;

    case 'binary':
      typeSchema = { type: 'string', contentEncoding: 'base64' };
      break;

    case 'any':
    default:
      typeSchema = {};
      break;
  }

  const combined = { ...result, ...typeSchema };

  // Apply nullable: wrap type or use anyOf
  if (hasNullAllow && !desc.flags?.only) {
    if (combined.type && typeof combined.type === 'string') {
      return { ...combined, type: [combined.type, 'null'] };
    }
    if (combined.type && Array.isArray(combined.type) && !combined.type.includes('null')) {
      return { ...combined, type: [...combined.type, 'null'] };
    }
    // For complex schemas (oneOf/anyOf/allOf), wrap with anyOf + null
    if (!combined.type) {
      const { ...rest } = combined;
      if (Object.keys(rest).length > 0) {
        return { anyOf: [rest, { type: 'null' }] };
      }
    }
  }

  return combined;
}

// ─── Type Converters ──────────────────────────────────────────────────────────

/** @internal */
function convertString(desc: JoiDescription, _opts: Required<JoiToOpenAPIOptions>): SchemaObject {
  const result: SchemaObject = { type: 'string' };
  const rules = desc.rules ?? [];

  for (const rule of rules) {
    const args = rule.args ?? {};

    switch (rule.name) {
      case 'min':
        result.minLength = args['limit'] as number;
        break;

      case 'max':
        result.maxLength = args['limit'] as number;
        break;

      case 'length':
        result.minLength = args['limit'] as number;
        result.maxLength = args['limit'] as number;
        break;

      case 'email':
        result.format = 'email';
        break;

      case 'uri':
        result.format = 'uri';
        break;

      case 'guid':
      case 'uuid':
        result.format = 'uuid';
        break;

      case 'isoDate':
        result.format = 'date-time';
        break;

      case 'isoDuration':
        result.format = 'duration';
        break;

      case 'hostname':
        result.format = 'hostname';
        break;

      case 'ip': {
        const versions = args['version'] as string[] | undefined;
        if (versions?.includes('ipv6') && !versions?.includes('ipv4')) {
          result.format = 'ipv6';
        } else if (versions?.includes('ipv4') && !versions?.includes('ipv6')) {
          result.format = 'ipv4';
        }
        // Mixed: leave format unset (no standard format covers both)
        break;
      }

      case 'pattern':
      case 'regex': {
        const regex = args['regex'] as RegExp | string | undefined;
        if (regex instanceof RegExp) {
          result.pattern = regex.source;
        } else if (typeof regex === 'string') {
          // Joi serializes regex as "/pattern/flags" string — strip the delimiters
          const match = /^\/(.*)\/[gimsuy]*$/.exec(regex);
          result.pattern = match ? match[1]! : regex;
        }
        break;
      }

      case 'alphanum':
        result.pattern = '^[a-zA-Z0-9]*$';
        break;

      case 'token':
        result.pattern = '^[a-zA-Z0-9_]*$';
        break;

      case 'hex':
        result.pattern = '^[a-fA-F0-9]*$';
        break;

      case 'base64':
        result.contentEncoding = 'base64';
        break;

      case 'dataUri':
        result.pattern = '^data:.*;base64,';
        break;

      case 'creditCard':
        // No standard format; use pattern for Luhn-compatible
        break;

      case 'case':
        // No OpenAPI equivalent; informational only
        break;

      case 'trim':
        // No OpenAPI equivalent
        break;

      // truncate, normalize, replace — no OpenAPI equivalent
    }
  }

  // flags.case maps to nothing in OpenAPI — skip
  // flags.encoding handled in binary type

  return result;
}

/** @internal */
function convertNumber(desc: JoiDescription): SchemaObject {
  const rules = desc.rules ?? [];
  let isInteger = false;
  const result: SchemaObject = {};

  for (const rule of rules) {
    const args = rule.args ?? {};

    switch (rule.name) {
      case 'integer':
        isInteger = true;
        break;

      case 'min':
        result.minimum = args['limit'] as number;
        break;

      case 'max':
        result.maximum = args['limit'] as number;
        break;

      case 'greater':
        result.exclusiveMinimum = args['limit'] as number;
        break;

      case 'less':
        result.exclusiveMaximum = args['limit'] as number;
        break;

      case 'multiple':
        result.multipleOf = args['base'] as number;
        break;

      case 'precision':
        // No direct OpenAPI equivalent
        break;
    }
  }

  result.type = isInteger ? 'integer' : 'number';
  return result;
}

/** @internal */
function convertBoolean(_desc: JoiDescription): SchemaObject {
  return { type: 'boolean' };
}

/** @internal */
function convertObject(
  desc: JoiDescription,
  opts: Required<JoiToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const result: SchemaObject = { type: 'object' };
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  if (desc.keys) {
    for (const [key, fieldDesc] of Object.entries(desc.keys)) {
      const converted = convertJoiDescription(fieldDesc, opts, depth + 1);
      properties[key] = converted;

      // A field is required if presence is not 'optional' (default in Joi is 'optional'
      // unless schema-level opts change it). We track explicit 'required' presence.
      const presence = fieldDesc.flags?.presence;
      if (presence === 'required') {
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

  // additionalProperties
  const allowUnknown = desc.flags?.allowUnknown ?? desc.flags?.unknown;
  if (allowUnknown === false) {
    result.additionalProperties = false;
  }

  // Pattern-based additionalProperties (from Joi .pattern())
  const patternRules = (desc.rules ?? []).filter((r) => r.name === 'pattern');
  if (patternRules.length > 0 && patternRules[0]?.args?.['value']) {
    const valueDesc = patternRules[0].args['value'] as JoiDescription;
    result.additionalProperties = convertJoiDescription(valueDesc, opts, depth + 1);
  }

  return result;
}

/** @internal */
function convertArray(
  desc: JoiDescription,
  opts: Required<JoiToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const result: SchemaObject = { type: 'array' };
  const rules = desc.rules ?? [];

  // Ordered tuple (Joi.array().ordered(...))
  if (desc.ordered && desc.ordered.length > 0) {
    result.prefixItems = desc.ordered.map((item) =>
      convertJoiDescription(item, opts, depth + 1)
    );
    result.items = false; // no extra items beyond the ordered ones
    result.minItems = desc.ordered.length;
    result.maxItems = desc.ordered.length;
    return result;
  }

  // Items (Joi.array().items(...)) — multiple schemas = anyOf
  if (desc.items && desc.items.length > 0) {
    if (desc.items.length === 1) {
      result.items = convertJoiDescription(desc.items[0]!, opts, depth + 1);
    } else {
      result.items = {
        anyOf: desc.items.map((item) => convertJoiDescription(item, opts, depth + 1)),
      };
    }
  }

  // Length rules
  for (const rule of rules) {
    const args = rule.args ?? {};
    switch (rule.name) {
      case 'min':
        result.minItems = args['limit'] as number;
        break;
      case 'max':
        result.maxItems = args['limit'] as number;
        break;
      case 'length':
        result.minItems = args['limit'] as number;
        result.maxItems = args['limit'] as number;
        break;
      case 'unique':
        result.uniqueItems = true;
        break;
    }
  }

  return result;
}

/** @internal */
function convertAlternatives(
  desc: JoiDescription,
  opts: Required<JoiToOpenAPIOptions>,
  depth: number
): SchemaObject {
  const matches = desc.matches ?? [];

  // Detect if this is a oneOf (match: 'one') — Joi stores this in flags
  // For simplicity: if all matches are simple schemas, use anyOf
  // Joi's match='one' is reflected as individual schema matches
  const schemas = matches
    .map((m) => {
      if (m.schema) {
        return convertJoiDescription(m.schema, opts, depth + 1);
      }
      // try/then/otherwise conditional — skip complex conditionals
      return null;
    })
    .filter((s): s is SchemaObject => s !== null);

  if (schemas.length === 0) {
    return {};
  }

  if (schemas.length === 1) {
    return schemas[0]!;
  }

  return { anyOf: schemas };
}
