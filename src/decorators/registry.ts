/**
 * Internal decorator metadata registry.
 *
 * Stores metadata attached via decorators on controller classes and methods.
 * This metadata is later used to generate OpenAPI operations.
 */

import type {
  OperationObject,
  ParameterObject,
  ResponseObject,
  RequestBodyObject,
  SchemaObject,
  RefOr,
} from '../types/openapi3_1.js';

// ─── Metadata Keys ────────────────────────────────────────────────────────────

export const META_CONTROLLER = Symbol('spectopus:controller');
export const META_OPERATION = Symbol('spectopus:operation');
export const META_PARAMETERS = Symbol('spectopus:parameters');
export const META_RESPONSES = Symbol('spectopus:responses');
export const META_BODY = Symbol('spectopus:body');
export const META_TAGS = Symbol('spectopus:tags');
export const META_SECURITY = Symbol('spectopus:security');

// ─── Metadata Types ───────────────────────────────────────────────────────────

export interface ControllerMeta {
  basePath: string;
  tags?: string[];
  description?: string;
}

export interface OperationMeta {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
}

export interface ParameterMeta {
  name: string;
  in: ParameterObject['in'];
  schema?: RefOr<SchemaObject>;
  description?: string;
  required?: boolean;
}

export interface ResponseMeta {
  statusCode: number | string;
  schema?: RefOr<SchemaObject>;
  description?: string;
  mediaType?: string;
}

export interface BodyMeta {
  schema: RefOr<SchemaObject>;
  description?: string;
  required?: boolean;
  mediaType?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Weak map storing all decorator metadata by target.
 */
const controllerRegistry = new Map<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]) => any,
  {
    controller: ControllerMeta;
    methods: Map<string | symbol, {
      operation: OperationMeta;
      parameters: ParameterMeta[];
      responses: ResponseMeta[];
      body?: BodyMeta;
    }>;
  }
>();

// ─── Registry Functions ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ControllerClass = new (...args: any[]) => any;

export function registerController(target: ControllerClass, meta: ControllerMeta): void {
  const existing = controllerRegistry.get(target);
  if (existing) {
    existing.controller = meta;
  } else {
    controllerRegistry.set(target, { controller: meta, methods: new Map() });
  }
}

export function registerOperation(
  target: ControllerClass,
  methodName: string | symbol,
  meta: OperationMeta
): void {
  let entry = controllerRegistry.get(target);
  if (!entry) {
    entry = { controller: { basePath: '/' }, methods: new Map() };
    controllerRegistry.set(target, entry);
  }

  const existing = entry.methods.get(methodName);
  if (existing) {
    existing.operation = { ...existing.operation, ...meta };
  } else {
    entry.methods.set(methodName, {
      operation: meta,
      parameters: [],
      responses: [],
    });
  }
}

export function registerParameter(
  target: ControllerClass,
  methodName: string | symbol,
  param: ParameterMeta
): void {
  let entry = controllerRegistry.get(target);
  if (!entry) {
    entry = { controller: { basePath: '/' }, methods: new Map() };
    controllerRegistry.set(target, entry);
  }

  let methodEntry = entry.methods.get(methodName);
  if (!methodEntry) {
    methodEntry = { operation: { method: 'get', path: '/' }, parameters: [], responses: [] };
    entry.methods.set(methodName, methodEntry);
  }

  methodEntry.parameters.push(param);
}

export function registerResponse(
  target: ControllerClass,
  methodName: string | symbol,
  response: ResponseMeta
): void {
  let entry = controllerRegistry.get(target);
  if (!entry) {
    entry = { controller: { basePath: '/' }, methods: new Map() };
    controllerRegistry.set(target, entry);
  }

  let methodEntry = entry.methods.get(methodName);
  if (!methodEntry) {
    methodEntry = { operation: { method: 'get', path: '/' }, parameters: [], responses: [] };
    entry.methods.set(methodName, methodEntry);
  }

  methodEntry.responses.push(response);
}

export function registerBody(
  target: ControllerClass,
  methodName: string | symbol,
  body: BodyMeta
): void {
  let entry = controllerRegistry.get(target);
  if (!entry) {
    entry = { controller: { basePath: '/' }, methods: new Map() };
    controllerRegistry.set(target, entry);
  }

  let methodEntry = entry.methods.get(methodName);
  if (!methodEntry) {
    methodEntry = { operation: { method: 'get', path: '/' }, parameters: [], responses: [] };
    entry.methods.set(methodName, methodEntry);
  }

  methodEntry.body = body;
}

// ─── Spec Extraction ──────────────────────────────────────────────────────────

/**
 * Extract OpenAPI operations from a decorated controller class.
 */
export function extractControllerOperations(
  target: ControllerClass
): Array<{
  path: string;
  method: string;
  operation: OperationObject;
}> {
  const entry = controllerRegistry.get(target);
  if (!entry) return [];

  const { controller, methods } = entry;
  const ops: Array<{ path: string; method: string; operation: OperationObject }> = [];

  for (const [, methodMeta] of methods.entries()) {
    const { operation, parameters, responses, body } = methodMeta;

    // Combine controller base path with method path
    const fullPath = joinPaths(controller.basePath, operation.path);

    // Build tags
    const allTags = [
      ...(controller.tags ?? []),
      ...(operation.tags ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const opObj: OperationObject = {
      ...(operation.operationId ? { operationId: operation.operationId } : {}),
      ...(operation.summary ? { summary: operation.summary } : {}),
      ...(operation.description ? { description: operation.description } : {}),
      ...(allTags.length > 0 ? { tags: allTags } : {}),
      ...(operation.deprecated ? { deprecated: true } : {}),
      ...(operation.security ? { security: operation.security } : {}),
      responses: {},
    };

    // Parameters
    if (parameters.length > 0) {
      opObj.parameters = parameters.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required ?? p.in === 'path',
        ...(p.description ? { description: p.description } : {}),
        ...(p.schema ? { schema: p.schema } : {}),
      }));
    }

    // Request body
    if (body) {
      opObj.requestBody = {
        required: body.required ?? true,
        ...(body.description ? { description: body.description } : {}),
        content: {
          [body.mediaType ?? 'application/json']: {
            schema: body.schema,
          },
        },
      } as RequestBodyObject;
    }

    // Responses
    if (responses.length > 0) {
      for (const res of responses) {
        const responseObj: ResponseObject = {
          description: res.description ?? 'Response',
          ...(res.schema
            ? {
                content: {
                  [res.mediaType ?? 'application/json']: {
                    schema: res.schema,
                  },
                },
              }
            : {}),
        };
        opObj.responses![String(res.statusCode)] = responseObj;
      }
    } else {
      opObj.responses!['200'] = { description: 'Successful response' };
    }

    ops.push({ path: fullPath, method: operation.method, operation: opObj });
  }

  return ops;
}

function joinPaths(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanBase + cleanPath;
}
