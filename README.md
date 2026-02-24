# 🐙 spectopus

**The OpenAPI 3.1 spec builder where docs live with the code that proves them true.**

[![npm version](https://img.shields.io/npm/v/spectopus.svg)](https://www.npmjs.com/package/spectopus)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-green.svg)](https://spec.openapis.org/oas/v3.1.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero deps](https://img.shields.io/badge/runtime_deps-0-brightgreen.svg)](#zero-dependencies)
[![Tests](https://img.shields.io/badge/tests-161%20passing-brightgreen.svg)](#)

---

## The Problem with API Docs

Every API has two definitions of itself. The real one — the code — and the documentary one: Swagger YAML, JSDoc annotations, a Notion page, a Postman collection. The two diverge the moment they're created.

You rename a field. The code is updated. The docs? Maybe. Eventually. If someone remembers.

You add a query parameter. You write the logic. Then, separately, you open the Swagger YAML and write it again. Two sources of truth means one of them is lying.

**spectopus is built on a different premise: documentation that is derived from the code can never drift from the code.**

---

## Write Once: Code *and* Docs

```ts
import { z } from 'zod';
import { SpecBuilder, OperationBuilder } from 'spectopus';

// This schema validates incoming requests at runtime.
// spectopus reads it to generate your docs.
// One definition. Both jobs.
const CreateUserSchema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email(),
  role:  z.enum(['admin', 'user', 'guest']).optional(),
});

const spec = new SpecBuilder()
  .title('User API').version('1.0.0')
  .bearerAuth()
  .add('/users', 'post',
    new OperationBuilder()
      .summary('Create a user')
      .body(CreateUserSchema)          // ← same schema you parse with at runtime
      .response(201, UserSchema)
      .response(400, ErrorSchema)
  )
  .build();
```

Change `CreateUserSchema` and your documentation changes with it — automatically, correctly, immediately. **No separate annotation to update. No drift possible.**

---

## Features

| Feature | Details |
|---|---|
| **OpenAPI 3.1** | Full spec support including JSON Schema 2020-12 |
| **Fluent builder API** | Chainable, immutable, TypeScript-native |
| **Zod integration** | Your validation schemas become your API docs |
| **LLM adapters** | Export as OpenAI tools, Anthropic tools, or compact context |
| **Decorator API** | Class-based controllers with colocated docs |
| **Zero runtime deps** | Pure TypeScript. Nothing to audit. Nothing to break. |
| **Framework-agnostic** | Works with Express, Fastify, Hono, Koa, bare Node, anything |
| **Type-safe** | Full TypeScript types for the entire OpenAPI 3.1 spec |

---

## Installation

```bash
npm install spectopus
# If using Zod integration (recommended):
npm install zod
```

spectopus has **zero required runtime dependencies**. Zod is an optional peer dependency — install it only if you want the Zod adapter.

---

## Quick Start

```ts
import { z } from 'zod';
import { SpecBuilder, OperationBuilder, toLLM } from 'spectopus';

// Your schemas. Used for validation already.
// Now they're your documentation too.
const UserSchema = z.object({
  id:        z.string().uuid(),
  name:      z.string().min(1).max(100),
  email:     z.string().email(),
  role:      z.enum(['admin', 'user', 'guest']),
  createdAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  error: z.string(),
  code:  z.string().optional(),
});

const spec = new SpecBuilder()
  .title('My API')
  .version('1.0.0')
  .server('https://api.example.com', 'Production')
  .server('http://localhost:3000', 'Development')
  .bearerAuth()
  .tag('Users', 'User management')
  .component('User', UserSchema)
  .component('Error', ErrorSchema)

  .add('/users', 'get',
    new OperationBuilder()
      .summary('List users')
      .tag('Users')
      .query('page',  z.number().int().min(1).default(1),   'Page number')
      .query('limit', z.number().int().min(1).max(100).default(20), 'Per page')
      .response(200, z.object({ users: z.array(UserSchema), total: z.number() }))
      .response(401, ErrorSchema, 'Unauthorized')
  )
  .add('/users/:id', 'get',
    new OperationBuilder()
      .summary('Get user by ID')
      .tag('Users')
      .pathParam('id', z.string().uuid(), 'User UUID')
      .response(200, '#/components/schemas/User', 'User found')
      .response(404, ErrorSchema, 'Not found')
  )
  .add('/users', 'post',
    new OperationBuilder()
      .summary('Create user')
      .tag('Users')
      .body(z.object({ name: z.string(), email: z.string().email() }))
      .response(201, '#/components/schemas/User', 'Created')
      .response(400, ErrorSchema, 'Validation error')
  )
  .build();

// Serve as OpenAPI JSON
console.log(JSON.stringify(spec, null, 2));

// One line to LLM tools — always accurate because they come from your real spec
const openaiTools     = toLLM.openai(spec);
const anthropicTools  = toLLM.anthropic(spec);
const compactContext  = toLLM.compact(spec);   // paste into system prompts
```

---

## LLM Integration

This is where spectopus earns its name.

### OpenAI Function Calling

```ts
import { toLLM } from 'spectopus';
import OpenAI from 'openai';

const tools = toLLM.openai(spec);
// [{ type: 'function', function: { name: 'listUsers', description: '...', parameters: {...} } }]

const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Show me all admin users' }],
  tools,
});
```

### Anthropic Tool Use

```ts
import Anthropic from '@anthropic-ai/sdk';

const tools = toLLM.anthropic(spec);
// [{ name: 'listUsers', description: '...', input_schema: {...} }]

const anthropic = new Anthropic();
const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: 'Create a guest account for john@example.com' }],
  tools,
  max_tokens: 1024,
});
```

### Compact Context (Token-Efficient)

For pasting into system prompts — maximum information density, minimum tokens:

```ts
const context = toLLM.compact(spec);
```

Output:
```
API: My API v1.0.0
Base: https://api.example.com
Auth: Bearer JWT (Authorization header)

### Users
GET    /users — List users
  Query: ?page(int,default:1), ?limit(int,1-100,default:20)
  → 200: { users: User[], total: int }
  → 401: { error: string }

GET    /users/{id} — Get user by ID
  Path: id(uuid)
  → 200: User
  → 404: { error: string }

POST   /users — Create user
  Body: { name: string, email: email }
  → 201: User
  → 400: { error: string }

Schemas:
  User: { id: uuid, name: string, email: email, role: "admin" | "user" | "guest", createdAt: datetime }
  Error: { error: string, code?: string }
```

### Filter and Customize LLM Output

```ts
// Only expose certain tags to the LLM
const tools = toLLM.openai(spec, { includeTags: ['Users', 'Orders'] });

// Exclude sensitive endpoints
const tools = toLLM.openai(spec, { excludeOperations: ['deleteUser', 'adminPanel'] });

// OpenAI strict mode (structured outputs)
const tools = toLLM.openai(spec, { strict: true });

// Limit to N tools (LLMs have limits)
const tools = toLLM.openai(spec, { limit: 20 });
```

---

## Zod Integration

spectopus treats Zod schemas as first-class citizens throughout the entire API.
Pass Zod schemas anywhere a schema is expected:

```ts
import { z } from 'zod';
import { zodToOpenAPI } from 'spectopus';

// Manual conversion if you need the raw schema object
const openAPISchema = zodToOpenAPI(z.object({
  id:       z.string().uuid(),
  name:     z.string().min(1).max(100),
  age:      z.number().int().min(0).max(150).optional(),
  role:     z.enum(['admin', 'user']).default('user'),
  tags:     z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
}));
```

### Supported Zod Types

| Zod Type | OpenAPI Output |
|---|---|
| `z.string()` | `{ type: "string" }` |
| `z.string().email()` | `{ type: "string", format: "email" }` |
| `z.string().uuid()` | `{ type: "string", format: "uuid" }` |
| `z.string().url()` | `{ type: "string", format: "uri" }` |
| `z.string().datetime()` | `{ type: "string", format: "date-time" }` |
| `z.string().min(n).max(m)` | `{ minLength: n, maxLength: m }` |
| `z.string().regex(/.../)` | `{ pattern: "..." }` |
| `z.number()` | `{ type: "number" }` |
| `z.number().int()` | `{ type: "integer" }` |
| `z.number().min(n).max(m)` | `{ minimum: n, maximum: m }` |
| `z.number().gt(n).lt(m)` | `{ exclusiveMinimum: n, exclusiveMaximum: m }` |
| `z.boolean()` | `{ type: "boolean" }` |
| `z.null()` | `{ type: "null" }` |
| `z.literal(x)` | `{ const: x }` |
| `z.enum([...])` | `{ type: "string", enum: [...] }` |
| `z.object({...})` | Full object schema with `required[]` |
| `z.object({...}).strict()` | `additionalProperties: false` |
| `z.array(T)` | `{ type: "array", items: T }` |
| `z.array(T).min(n).max(m)` | `{ minItems: n, maxItems: m }` |
| `z.tuple([A, B])` | `{ prefixItems: [A, B], items: false }` |
| `z.union([A, B])` | `{ anyOf: [A, B] }` |
| `z.intersection(A, B)` | `{ allOf: [A, B] }` |
| `z.discriminatedUnion(...)` | `{ anyOf: [...] }` |
| `z.optional(T)` | Inner type (marked not-required in parent) |
| `z.nullable(T)` | `{ type: ["T", "null"] }` (JSON Schema 2020-12) |
| `z.default(v)` | Inner type + `{ default: v }` |
| `z.readonly(T)` | Inner type + `{ readOnly: true }` |
| `z.record(T)` | `{ type: "object", additionalProperties: T }` |
| `z.set(T)` | `{ type: "array", uniqueItems: true, items: T }` |
| `z.branded(T)` | Inner type (brand erased) |
| `z.describe("...")` | `{ description: "..." }` |

---

## Decorator API

For class-based controller patterns. Put your docs where your handlers live.

```ts
import { z } from 'zod';
import {
  Controller, Get, Post, Patch, Delete,
  Query, Path, Body,
  Response,
  Tag, Summary, Description,
} from 'spectopus/decorators';

const UserSchema = z.object({
  id:    z.string().uuid(),
  name:  z.string(),
  email: z.string().email(),
});

const ErrorSchema = z.object({ error: z.string() });

@Controller('/users')
@Tag('Users')
class UserController {

  @Get()
  @Summary('List all users')
  @Query('page',  z.number().int().default(1),   'Page number')
  @Query('limit', z.number().int().max(100).default(20), 'Per page')
  @Response(200, z.object({ users: z.array(UserSchema) }), 'User list')
  async listUsers(req, res) {
    const { page, limit } = UserListQuerySchema.parse(req.query);
    // ... implementation
  }

  @Get('/:id')
  @Summary('Get user by ID')
  @Path('id', z.string().uuid(), 'User ID')
  @Response(200, UserSchema, 'User found')
  @Response(404, ErrorSchema, 'Not found')
  async getUser(req, res) {
    const { id } = req.params;
    // ... implementation
  }

  @Post()
  @Summary('Create a user')
  @Body(z.object({ name: z.string(), email: z.string().email() }))
  @Response(201, UserSchema, 'Created')
  @Response(400, ErrorSchema, 'Validation error')
  async createUser(req, res) {
    // ... implementation
  }

  @Delete('/:id')
  @Summary('Delete user')
  @Path('id', z.string().uuid())
  @Response(204, undefined, 'Deleted')
  async deleteUser(req, res) {
    // ... implementation
  }
}

// Extract and build
import { extractControllerOperations } from 'spectopus/decorators';
import { SpecBuilder } from 'spectopus';

const ops = extractControllerOperations(UserController);

let builder = new SpecBuilder().title('My API').version('1.0.0').bearerAuth();
for (const { path, method, operation } of ops) {
  builder = builder.add(path, method, operation);
}
const spec = builder.build();
```

---

## Schema Components

Register reusable schemas to `$ref` them throughout your spec:

```ts
const spec = new SpecBuilder()
  .title('My API').version('1.0.0')
  // Register once
  .component('User', UserSchema)
  .component('Error', ErrorSchema)
  // Reference anywhere with '#/components/schemas/Name'
  .add('/users/:id', 'get',
    new OperationBuilder()
      .response(200, '#/components/schemas/User')
      .response(404, '#/components/schemas/Error')
  )
  .build();
```

---

## Security Schemes

```ts
const spec = new SpecBuilder()
  .title('Secure API').version('1.0.0')

  // Bearer JWT — applied globally
  .bearerAuth()

  // API key — applied globally
  .apiKeyAuth('apiKey', 'X-API-Key')

  // Custom scheme
  .securityScheme('oauth2', {
    type: 'oauth2',
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://auth.example.com/oauth/authorize',
        tokenUrl: 'https://auth.example.com/oauth/token',
        scopes: { 'read:users': 'Read users', 'write:users': 'Write users' },
      },
    },
  })
  .add('/users', 'get',
    new OperationBuilder()
      .noAuth()               // Override: this endpoint is public
      .response(200, UserListSchema)
  )
  .add('/users', 'post',
    new OperationBuilder()
      .oauth2('oauth2', 'write:users')  // Require specific scope
      .body(CreateUserSchema)
      .response(201, UserSchema)
  )
  .build();
```

---

## Full API Reference

### SpecBuilder

```ts
new SpecBuilder(options?)
  // Info
  .title(string)
  .version(string)
  .description(string)
  .summary(string)
  .contact(name, email?, url?)
  .license(name, url?)
  .termsOfService(url)

  // Servers
  .server(url, description?)

  // Operations
  .add(path, method, operation)
  .addRoutes([[path, method, operation], ...])
  .paths(PathsObject)

  // Tags
  .tag(name, description?)

  // Security
  .bearerAuth(schemeName?, applyGlobally?)
  .apiKeyAuth(schemeName?, header?, applyGlobally?)
  .security(SecurityRequirementObject)
  .securityScheme(name, SecuritySchemeObject)

  // Components
  .component(name, schema)
  .components(ComponentsBuilder)

  // Output
  .build()                   // → OpenAPIDocument
  .toJSON(indent?)           // → string (JSON)
  .toYAML()                  // → Promise<string> (requires 'yaml' package)
```

### OperationBuilder

```ts
new OperationBuilder()
  // Identity
  .operationId(string)
  .summary(string)
  .description(string)
  .tag(string)
  .tags(...strings)
  .deprecated(boolean?)

  // Parameters
  .query(name, schema, description?, required?)
  .requiredQuery(name, schema, description?)
  .pathParam(name, schema, description?)
  .header(name, schema, description?, required?)
  .cookie(name, schema, description?, required?)
  .param(ParameterObject)

  // Body
  .body(schema, description?, required?)
  .bodyContent(mediaType, schema, description?, required?)
  .formBody(schema, description?, required?)
  .requestBody(RequestBodyObject)

  // Responses
  .response(statusCode, schema, description?)
  .noContent(statusCode?, description?)
  .rawResponse(statusCode, ResponseObject)

  // Security
  .bearerAuth(schemeName?)
  .apiKeyAuth(schemeName?)
  .oauth2(schemeName?, ...scopes)
  .noAuth()
  .security(SecurityRequirementObject)

  // Output
  .build()                   // → OperationObject
```

### toLLM Adapters

```ts
import { toLLM } from 'spectopus';

// OpenAI function calling
toLLM.openai(spec, {
  strict?: boolean,            // Enable structured outputs mode
  includeTags?: string[],      // Filter by tag
  excludeOperations?: string[], // Exclude by operationId
  limit?: number,              // Max tools to return
})

// Anthropic tool use
toLLM.anthropic(spec, {
  includeTags?: string[],
  excludeOperations?: string[],
  limit?: number,
  includePathInDescription?: boolean,
})

// Compact text for system prompts
toLLM.compact(spec, {
  includeSchemas?: boolean,
  includeServers?: boolean,
  includeSecurity?: boolean,
  includeParamDescriptions?: boolean,
  includeTags?: string[],
  maxSchemaDepth?: number,
})
```

### zodToOpenAPI

```ts
import { zodToOpenAPI } from 'spectopus';

zodToOpenAPI(zodSchema, {
  includeDescriptions?: boolean,  // Include .describe() text
  includeDefaults?: boolean,      // Include .default() values
  maxDepth?: number,              // Max recursion depth (default: 20)
})
```

---

## Zero Dependencies

spectopus's runtime has **no required dependencies**. Zero. The package is pure TypeScript compiled to JavaScript.

- **Zod** is an optional peer dependency. Install it only if you want the Zod adapter. Without it, you can still use plain `SchemaObject` definitions.
- **YAML libraries** (`yaml` or `js-yaml`) are only needed if you call `.toYAML()`. Neither is required.
- **LLM SDKs** are not required — spectopus just produces plain JavaScript objects that match the tool definition formats.

This means spectopus is fast to install, easy to audit, and won't bloat your dependencies. The bundle is small and tree-shakeable.

---

## Why not swagger-jsdoc? Why not tsoa?

| | spectopus | swagger-jsdoc | tsoa | typed-openapi |
|---|---|---|---|---|
| **Colocation** | ✅ Schema IS the doc | ❌ JSDoc is separate annotation | ⚠️ Decorator-only | ❌ Manual types |
| **Zod-native** | ✅ First-class | ❌ | ❌ | ❌ |
| **LLM adapters** | ✅ Built-in | ❌ | ❌ | ❌ |
| **Runtime deps** | ✅ Zero | ⚠️ Some | ⚠️ Some | ✅ Zero |
| **OpenAPI 3.1** | ✅ | ⚠️ Partial | ⚠️ 3.0 | ✅ |
| **Fluent API** | ✅ | ❌ | ❌ | ❌ |
| **Drift possible** | ❌ Never | ✅ Always | ⚠️ Sometimes | ✅ Always |

**swagger-jsdoc** requires you to write your API schema twice: once in code, once in JSDoc. Those two things will diverge.

**tsoa** is closer — decorators are colocated — but it doesn't support Zod, doesn't have LLM adapters, and its OpenAPI 3.1 support is incomplete.

**spectopus** is designed from the ground up for the principle that the schema that validates your runtime data *is* the schema that documents your API. No copies. No synchronization. One source of truth.

---

## Framework Examples

### Express

```ts
import express from 'express';
import { spec } from './spec.js';

const app = express();
app.use(express.json());

// Serve docs
app.get('/openapi.json', (req, res) => res.json(spec));
// Optional: serve Swagger UI
// app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));

// Your routes use the same Zod schemas for validation:
app.post('/users', async (req, res) => {
  const body = CreateUserSchema.parse(req.body);  // same schema as the doc
  const user = await db.createUser(body);
  res.status(201).json(user);
});
```

### Fastify

```ts
import Fastify from 'fastify';
import { spec } from './spec.js';

const app = Fastify();

app.get('/openapi.json', async () => spec);

app.post('/users', {
  // Fastify can use JSON Schema for built-in validation
  schema: { body: zodToOpenAPI(CreateUserSchema) },
  handler: async (req, reply) => {
    const user = await db.createUser(req.body);
    reply.status(201).send(user);
  },
});
```

### Hono

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { spec } from './spec.js';

const app = new Hono();

app.get('/openapi.json', (c) => c.json(spec));

app.post('/users',
  zValidator('json', CreateUserSchema),  // same schema as the doc
  async (c) => {
    const body = c.req.valid('json');
    const user = await db.createUser(body);
    return c.json(user, 201);
  }
);
```

---

## The Philosophy

The central insight behind spectopus:

**Documentation that is generated from the source of truth can never drift from the source of truth.**

When you use swagger-jsdoc, you write:
```js
/**
 * @openapi
 * /users:
 *   post:
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string    ← Is this still accurate?
 *               email:
 *                 type: string    ← Who checks?
 */
app.post('/users', (req, res) => {
  const { name, email } = CreateUserSchema.parse(req.body);
  // CreateUserSchema may have changed last week.
  // The JSDoc above hasn't.
});
```

When you use spectopus, you write:
```ts
.body(CreateUserSchema)  // ← If the schema changes, the doc changes. Always.
```

There is no annotation to forget. There is no second place to update. The documentation is a *view* over the code, not a parallel copy of it.

This is especially powerful for LLM tools, where stale function definitions cause silent failures: the LLM calls a function with parameters that no longer exist. With spectopus, that class of error is impossible.

---

## Contributing

Contributions are very welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

Areas we'd love help with:
- More Zod type coverage edge cases
- Joi → OpenAPI adapter (`spectopus/adapters/joi`)
- Valibot adapter (`spectopus/adapters/valibot`)
- Express/Fastify/Hono route extraction helpers
- CLI tool (`spectopus generate --output openapi.json`)
- OpenAPI spec validation (full schema validation, not just structural)

---

## License

MIT © spectopus contributors
