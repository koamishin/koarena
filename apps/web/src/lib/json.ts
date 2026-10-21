/**
 * A JSON-safe value.
 *
 * TanStack Start type-checks everything a server function returns against
 * its serializer. `unknown` is not serializable, and a single `unknown` in a
 * return type collapses the whole inferred type — so config objects use this
 * instead.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
