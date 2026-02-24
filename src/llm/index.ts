/**
 * LLM adapter exports for spectopus.
 *
 * Provides adapters for converting OpenAPI specs to LLM-native formats.
 */

export { toOpenAITools, type OpenAITool, type OpenAIFunction, type OpenAIFunctionParameters, type OpenAIToolsOptions } from './openai.js';
export { toAnthropicTools, type AnthropicTool, type AnthropicToolInputSchema, type AnthropicToolsOptions } from './anthropic.js';
export { toCompact, type CompactOptions } from './compact.js';

import { toOpenAITools, type OpenAIToolsOptions } from './openai.js';
import { toAnthropicTools, type AnthropicToolsOptions } from './anthropic.js';
import { toCompact, type CompactOptions } from './compact.js';
import type { OpenAPIDocument } from '../types/openapi3_1.js';

/**
 * Unified LLM adapter namespace.
 *
 * @example
 * ```ts
 * import { toLLM } from 'spectopus';
 *
 * const spec = new SpecBuilder()...build();
 *
 * const openaiTools = toLLM.openai(spec);
 * const anthropicTools = toLLM.anthropic(spec);
 * const compact = toLLM.compact(spec);
 * ```
 */
export const toLLM = {
  /**
   * Convert to OpenAI function/tool calling format.
   * Compatible with gpt-4o, gpt-4-turbo, and all function-calling capable models.
   */
  openai: (doc: OpenAPIDocument, options?: OpenAIToolsOptions) =>
    toOpenAITools(doc, options),

  /**
   * Convert to Anthropic tool use format.
   * Compatible with claude-3+ models.
   */
  anthropic: (doc: OpenAPIDocument, options?: AnthropicToolsOptions) =>
    toAnthropicTools(doc, options),

  /**
   * Convert to compact token-efficient text format.
   * Ideal for system prompts and context injection.
   */
  compact: (doc: OpenAPIDocument, options?: CompactOptions) =>
    toCompact(doc, options),
} as const;
