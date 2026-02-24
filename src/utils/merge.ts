/**
 * Deep merge utilities for combining OpenAPI spec objects.
 */

/**
 * Check if a value is a plain object (not array, not null, not class instance).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Deep merge two objects. Arrays are replaced (not merged).
 * The `source` object's values take precedence over `target`.
 *
 * @param target - The base object
 * @param source - The object to merge in (takes precedence)
 * @returns A new merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key as string] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else if (sourceVal !== undefined) {
      result[key as string] = sourceVal;
    }
  }

  return result as T;
}

/**
 * Merge multiple objects sequentially. Later objects take precedence.
 *
 * @param objects - Objects to merge (left to right, last wins)
 * @returns A new merged object
 */
export function mergeAll<T extends Record<string, unknown>>(
  ...objects: Partial<T>[]
): T {
  return objects.reduce<T>(
    (acc, obj) => deepMerge(acc, obj as Partial<T>),
    {} as T
  );
}

/**
 * Shallowly merge multiple objects. Useful for path items and responses.
 */
export function shallowMerge<T extends Record<string, unknown>>(
  ...objects: Partial<T>[]
): T {
  return Object.assign({}, ...objects) as T;
}

/**
 * Deep clone an object using JSON serialization.
 * Handles nested objects but not functions or special types.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
