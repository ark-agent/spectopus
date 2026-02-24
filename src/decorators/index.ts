/**
 * HTTP method decorators for class-based controllers.
 *
 * @example
 * ```ts
 * import { Controller, Get, Post } from 'spectopus/decorators';
 *
 * @Controller('/users')
 * class UserController {
 *   @Get()
 *   async list() { ... }
 *
 *   @Get('/:id')
 *   async getById() { ... }
 *
 *   @Post()
 *   async create() { ... }
 * }
 * ```
 */

import {
  registerController,
  registerOperation,
  type ControllerMeta,
} from './registry.js';

// ─── @Controller ──────────────────────────────────────────────────────────────

/**
 * Mark a class as a route controller with a base path.
 *
 * @param basePath - The URL base path for all routes in this controller
 * @param options - Additional controller options
 */
export function Controller(
  basePath: string,
  options: Partial<Pick<ControllerMeta, 'tags' | 'description'>> = {}
): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) => {
    registerController(target, {
      basePath,
      ...options,
    });
  };
}

// ─── HTTP Method Decorators ───────────────────────────────────────────────────

/**
 * Mark a method as handling GET requests.
 * @param path - Optional sub-path (default: '')
 */
export function Get(path = ''): MethodDecorator {
  return httpMethod('get', path);
}

/**
 * Mark a method as handling POST requests.
 * @param path - Optional sub-path (default: '')
 */
export function Post(path = ''): MethodDecorator {
  return httpMethod('post', path);
}

/**
 * Mark a method as handling PUT requests.
 * @param path - Optional sub-path (default: '')
 */
export function Put(path = ''): MethodDecorator {
  return httpMethod('put', path);
}

/**
 * Mark a method as handling PATCH requests.
 * @param path - Optional sub-path (default: '')
 */
export function Patch(path = ''): MethodDecorator {
  return httpMethod('patch', path);
}

/**
 * Mark a method as handling DELETE requests.
 * @param path - Optional sub-path (default: '')
 */
export function Delete(path = ''): MethodDecorator {
  return httpMethod('delete', path);
}

/**
 * Mark a method as handling HEAD requests.
 * @param path - Optional sub-path (default: '')
 */
export function Head(path = ''): MethodDecorator {
  return httpMethod('head', path);
}

/**
 * Mark a method as handling OPTIONS requests.
 * @param path - Optional sub-path (default: '')
 */
export function Options(path = ''): MethodDecorator {
  return httpMethod('options', path);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function httpMethod(method: string, path: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constructor = (target as any).constructor;
    registerOperation(constructor, propertyKey, {
      method,
      path: path || '/',
    });
  };
}

// Re-export everything from other decorator files
export * from './params.js';
export * from './response.js';
export * from './tags.js';
export { extractControllerOperations } from './registry.js';
