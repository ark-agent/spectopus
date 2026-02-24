/**
 * Metadata decorators: @Tag, @Summary, @Description, @OperationId, @Deprecated
 *
 * @example
 * ```ts
 * @Controller('/users')
 * @Tag('Users')
 * class UserController {
 *   @Get()
 *   @Summary('List all users')
 *   @Description('Returns a paginated list of users.')
 *   async listUsers() { ... }
 * }
 * ```
 */

import { registerController, registerOperation } from './registry.js';

// ─── Class-level Decorators ───────────────────────────────────────────────────

/**
 * Add a tag to all operations in a controller.
 * Can also be used on individual methods.
 *
 * @param name - Tag name
 */
export function Tag(name: string): ClassDecorator & MethodDecorator {
  return function (
    target: object | ((...args: unknown[]) => unknown),
    propertyKey?: string | symbol,
    _descriptor?: PropertyDescriptor
  ) {
    if (propertyKey !== undefined) {
      // Method decorator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constructor = (target as any).constructor;
      const existing = getOrCreateOperation(constructor, propertyKey);
      existing.tags = [...(existing.tags ?? []), name].filter((v, i, a) => a.indexOf(v) === i);
      registerOperation(constructor, propertyKey, existing);
    } else {
      // Class decorator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctrl = (target as any);
      const existing = getControllerMeta(ctrl);
      existing.tags = [...(existing.tags ?? []), name].filter((v, i, a) => a.indexOf(v) === i);
      registerController(ctrl, existing);
    }
  } as ClassDecorator & MethodDecorator;
}

// ─── Method-level Decorators ──────────────────────────────────────────────────

/**
 * Set the summary (short description) for an operation.
 *
 * @param text - Summary text (shown as operation title in docs)
 */
export function Summary(text: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = (target as any).constructor;
    const existing = getOrCreateOperation(constructor, propertyKey);
    existing.summary = text;
    registerOperation(constructor, propertyKey, existing);
  };
}

/**
 * Set the description (long description) for an operation.
 * CommonMark (Markdown) is supported.
 *
 * @param text - Description text
 */
export function Description(text: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = (target as any).constructor;
    const existing = getOrCreateOperation(constructor, propertyKey);
    existing.description = text;
    registerOperation(constructor, propertyKey, existing);
  };
}

/**
 * Set a custom operationId for an operation.
 * Must be unique across the entire spec.
 *
 * @param id - The operation ID
 */
export function OperationId(id: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = (target as any).constructor;
    const existing = getOrCreateOperation(constructor, propertyKey);
    existing.operationId = id;
    registerOperation(constructor, propertyKey, existing);
  };
}

/**
 * Mark an operation as deprecated.
 */
export function Deprecated(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = (target as any).constructor;
    const existing = getOrCreateOperation(constructor, propertyKey);
    existing.deprecated = true;
    registerOperation(constructor, propertyKey, existing);
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOrCreateOperation(target: any, methodName: string | symbol) {
  // We need to peek at the registry; import lazily to avoid circular deps
  // Instead, we'll just return a fresh operation meta that gets merged
  return {
    method: 'get',
    path: '/',
    tags: [] as string[],
    summary: undefined as string | undefined,
    description: undefined as string | undefined,
    operationId: undefined as string | undefined,
    deprecated: undefined as boolean | undefined,
    security: undefined as Array<Record<string, string[]>> | undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getControllerMeta(target: any) {
  return {
    basePath: '/',
    tags: [] as string[],
    description: undefined as string | undefined,
  };
}
