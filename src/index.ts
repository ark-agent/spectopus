/**
 * spectopus — The OpenAPI 3.1 spec builder that LLMs actually love.
 *
 * @example
 * ```ts
 * import { SpecBuilder, OperationBuilder, toLLM } from 'spectopus';
 * import { z } from 'zod';
 *
 * const spec = new SpecBuilder()
 *   .title('My API')
 *   .version('1.0.0')
 *   .server('https://api.example.com', 'Production')
 *   .bearerAuth()
 *   .add('/users', 'get',
 *     new OperationBuilder()
 *       .summary('List users')
 *       .tag('Users')
 *       .query('page', z.number().int().min(1).default(1), 'Page number')
 *       .response(200, z.object({ users: z.array(UserSchema) }), 'Users list')
 *   )
 *   .build();
 *
 * // Convert to LLM tools
 * const openaiTools = toLLM.openai(spec);
 * const anthropicTools = toLLM.anthropic(spec);
 * const compact = toLLM.compact(spec);
 * ```
 *
 * @module spectopus
 */

// ─── Core Builders ─────────────────────────────────────────────────────────────
export { SpecBuilder, normalizePath, generateOperationId } from './builder/SpecBuilder.js';
export type { SpecBuilderOptions } from './builder/SpecBuilder.js';

export { OperationBuilder } from './builder/OperationBuilder.js';

export { SchemaBuilder, schemas, isZodSchema } from './builder/SchemaBuilder.js';
export type { SchemaInput } from './builder/SchemaBuilder.js';

export { ResponseBuilder, jsonResponse, emptyResponse } from './builder/ResponseBuilder.js';

export {
  ParameterBuilder,
  queryParam,
  pathParam,
  headerParam,
  cookieParam,
} from './builder/ParameterBuilder.js';

export { ComponentsBuilder } from './builder/ComponentsBuilder.js';

// ─── LLM Adapters ─────────────────────────────────────────────────────────────
export { toLLM } from './llm/index.js';
export { toOpenAITools } from './llm/openai.js';
export type { OpenAITool, OpenAIFunction, OpenAIToolsOptions } from './llm/openai.js';

export { toAnthropicTools } from './llm/anthropic.js';
export type { AnthropicTool, AnthropicToolsOptions } from './llm/anthropic.js';

export { toCompact } from './llm/compact.js';
export type { CompactOptions } from './llm/compact.js';

// ─── Zod Adapter ──────────────────────────────────────────────────────────────
export { zodToOpenAPI } from './adapters/zod.js';
export type { ZodToOpenAPIOptions } from './adapters/zod.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  OpenAPIDocument,
  InfoObject,
  ServerObject,
  PathsObject,
  PathItemObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
  ComponentsObject,
  SecuritySchemeObject,
  SecurityRequirementObject,
  TagObject,
  ExternalDocumentationObject,
  MediaTypeObject,
  HeaderObject,
  ExampleObject,
  DiscriminatorObject,
  RefOr,
  HttpMethod,
  ParameterLocation,
  SchemaType,
  StringFormat,
} from './types/openapi3_1.js';

// ─── Utilities ─────────────────────────────────────────────────────────────────
export { validateSpec, assertValidSpec } from './utils/validate.js';
export type { ValidationResult, ValidationError } from './utils/validate.js';

export { deepMerge, mergeAll, shallowMerge, deepClone } from './utils/merge.js';

// Note: zod is an optional peer dependency.
// Import it directly in your project: import { z } from 'zod'
// spectopus works without zod — you can pass plain SchemaObjects instead.
