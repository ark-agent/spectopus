/**
 * Basic spec validation helpers for OpenAPI 3.1 documents.
 *
 * Provides lightweight structural validation without full schema validation.
 * For thorough validation, use tools like `@redocly/openapi-core` or `ajv`.
 */

import type { OpenAPIDocument } from '../types/openapi3_1.js';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate an OpenAPI 3.1 document for structural correctness.
 *
 * @param doc - The document to validate
 * @returns ValidationResult with any errors or warnings found
 */
export function validateSpec(doc: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!doc || typeof doc !== 'object') {
    errors.push({ path: '$', message: 'Document must be an object' });
    return { valid: false, errors, warnings };
  }

  const d = doc as Record<string, unknown>;

  // Check openapi version
  if (!d['openapi']) {
    errors.push({ path: 'openapi', message: 'Missing required field: openapi' });
  } else if (typeof d['openapi'] !== 'string' || !d['openapi'].startsWith('3.1.')) {
    errors.push({
      path: 'openapi',
      message: `openapi version must be 3.1.x, got: ${d['openapi']}`,
    });
  }

  // Check info
  if (!d['info']) {
    errors.push({ path: 'info', message: 'Missing required field: info' });
  } else if (typeof d['info'] === 'object') {
    const info = d['info'] as Record<string, unknown>;
    if (!info['title']) {
      errors.push({ path: 'info.title', message: 'Missing required field: info.title' });
    }
    if (!info['version']) {
      errors.push({ path: 'info.version', message: 'Missing required field: info.version' });
    }
  }

  // Check paths
  if (d['paths']) {
    if (typeof d['paths'] !== 'object') {
      errors.push({ path: 'paths', message: 'paths must be an object' });
    } else {
      const paths = d['paths'] as Record<string, unknown>;
      for (const [path, pathItem] of Object.entries(paths)) {
        if (!path.startsWith('/')) {
          errors.push({
            path: `paths.${path}`,
            message: `Path must start with '/': ${path}`,
          });
        }
        if (pathItem && typeof pathItem === 'object') {
          validatePathItem(path, pathItem as Record<string, unknown>, errors, warnings);
        }
      }
    }
  }

  // Check components
  if (d['components']) {
    validateComponents(d['components'] as Record<string, unknown>, errors, warnings);
  }

  // Warn about missing servers
  if (!d['servers'] || (Array.isArray(d['servers']) && d['servers'].length === 0)) {
    warnings.push({
      path: 'servers',
      message: 'No servers defined. API consumers may not know where to send requests.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validatePathItem(
  path: string,
  item: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
  let hasOperation = false;

  for (const method of methods) {
    if (item[method]) {
      hasOperation = true;
      validateOperation(path, method, item[method] as Record<string, unknown>, errors, warnings);
    }
  }

  if (!hasOperation && !item['$ref']) {
    warnings.push({
      path: `paths.${path}`,
      message: `Path item has no operations defined: ${path}`,
    });
  }
}

function validateOperation(
  path: string,
  method: string,
  op: Record<string, unknown>,
  errors: ValidationError[],
  _warnings: ValidationError[]
): void {
  const opPath = `paths.${path}.${method}`;

  if (!op['responses']) {
    errors.push({
      path: `${opPath}.responses`,
      message: `Operation ${method.toUpperCase()} ${path} has no responses defined`,
    });
  }

  // Validate operationId uniqueness (tracked externally)
  if (op['operationId'] && typeof op['operationId'] !== 'string') {
    errors.push({
      path: `${opPath}.operationId`,
      message: 'operationId must be a string',
    });
  }
}

function validateComponents(
  components: Record<string, unknown>,
  errors: ValidationError[],
  _warnings: ValidationError[]
): void {
  // Check that component names are valid identifiers
  const componentSections = [
    'schemas',
    'responses',
    'parameters',
    'requestBodies',
    'headers',
    'securitySchemes',
  ];

  for (const section of componentSections) {
    if (components[section]) {
      const sectionObj = components[section] as Record<string, unknown>;
      for (const name of Object.keys(sectionObj)) {
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
          errors.push({
            path: `components.${section}.${name}`,
            message: `Component name contains invalid characters: ${name}`,
          });
        }
      }
    }
  }
}

/**
 * Assert that a spec is valid, throwing if not.
 *
 * @param doc - The document to validate
 * @throws {Error} if validation fails
 */
export function assertValidSpec(doc: OpenAPIDocument): void {
  const result = validateSpec(doc);
  if (!result.valid) {
    const messages = result.errors.map((e) => `  - [${e.path}] ${e.message}`).join('\n');
    throw new Error(`Invalid OpenAPI 3.1 spec:\n${messages}`);
  }
}
