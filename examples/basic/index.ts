/**
 * Basic spectopus example — Express REST API
 *
 * This example shows the core colocation principle:
 * The Zod schemas you're ALREADY using for validation
 * become your API documentation automatically.
 *
 * No duplication. No drift. One source of truth.
 */

import { z } from 'zod';
import { SpecBuilder, OperationBuilder, toLLM } from '../../src/index.js';

// ─── Your existing Zod schemas ─────────────────────────────────────────────────
// These schemas are already used for runtime validation.
// spectopus reads them directly — no separate "swagger definitions" needed.

const UserSchema = z.object({
  id: z.string().uuid().describe('Unique user identifier'),
  name: z.string().min(1).max(100).describe('Display name'),
  email: z.string().email().describe('Email address'),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  createdAt: z.string().datetime().describe('ISO 8601 timestamp'),
});

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

const UpdateUserSchema = CreateUserSchema.partial();

const PaginatedUsersSchema = z.object({
  users: z.array(UserSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});

const ErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

// ─── Build the spec ────────────────────────────────────────────────────────────
// The SAME schemas used above for validation are passed directly to spectopus.
// If you change UserSchema, your docs update automatically. Zero drift possible.

const spec = new SpecBuilder()
  .title('User Management API')
  .version('1.0.0')
  .description(
    'A RESTful API for managing users. ' +
    'Docs are colocated with the code — powered by spectopus.'
  )
  .server('https://api.example.com/v1', 'Production')
  .server('https://staging.example.com/v1', 'Staging')
  .server('http://localhost:3000/v1', 'Development')
  .bearerAuth()
  .tag('Users', 'User management operations')
  .tag('Health', 'Service health endpoints')
  // Register reusable schemas so you can $ref them in responses
  .component('User', UserSchema)
  .component('Error', ErrorSchema)

  // ─── Health endpoint ────────────────────────────────────────────────────────
  .add('/health', 'get',
    new OperationBuilder()
      .operationId('healthCheck')
      .summary('Health check')
      .description('Returns the service health status. Does not require auth.')
      .tag('Health')
      .noAuth()
      .response(200, z.object({ status: z.literal('ok'), uptime: z.number() }), 'Service is healthy')
  )

  // ─── List users ─────────────────────────────────────────────────────────────
  .add('/users', 'get',
    new OperationBuilder()
      .operationId('listUsers')
      .summary('List users')
      .description('Returns a paginated list of users. Supports filtering by role.')
      .tag('Users')
      .query('page', z.number().int().min(1).default(1), 'Page number (1-indexed)')
      .query('limit', z.number().int().min(1).max(100).default(20), 'Results per page')
      .query('role', z.enum(['admin', 'user', 'guest']).optional(), 'Filter by role')
      .query('search', z.string().optional(), 'Search by name or email')
      .response(200, PaginatedUsersSchema, 'Paginated user list')
      .response(400, ErrorSchema, 'Invalid query parameters')
      .response(401, ErrorSchema, 'Not authenticated')
  )

  // ─── Create user ────────────────────────────────────────────────────────────
  .add('/users', 'post',
    new OperationBuilder()
      .operationId('createUser')
      .summary('Create a user')
      .description('Creates a new user account. Email must be unique.')
      .tag('Users')
      .body(CreateUserSchema, 'User creation payload')
      .response(201, '#/components/schemas/User', 'User created successfully')
      .response(400, ErrorSchema, 'Validation failed')
      .response(409, ErrorSchema, 'Email already in use')
  )

  // ─── Get user by ID ─────────────────────────────────────────────────────────
  .add('/users/:id', 'get',
    new OperationBuilder()
      .operationId('getUserById')
      .summary('Get user by ID')
      .description('Fetch a single user by their UUID.')
      .tag('Users')
      .pathParam('id', z.string().uuid(), 'User UUID')
      .response(200, '#/components/schemas/User', 'User found')
      .response(404, ErrorSchema, 'User not found')
  )

  // ─── Update user ─────────────────────────────────────────────────────────────
  .add('/users/:id', 'patch',
    new OperationBuilder()
      .operationId('updateUser')
      .summary('Update user')
      .description('Partially update a user. Only provided fields are changed.')
      .tag('Users')
      .pathParam('id', z.string().uuid(), 'User UUID')
      .body(UpdateUserSchema, 'Fields to update')
      .response(200, '#/components/schemas/User', 'User updated')
      .response(400, ErrorSchema, 'Validation failed')
      .response(404, ErrorSchema, 'User not found')
  )

  // ─── Delete user ─────────────────────────────────────────────────────────────
  .add('/users/:id', 'delete',
    new OperationBuilder()
      .operationId('deleteUser')
      .summary('Delete user')
      .description('Permanently delete a user. This action is irreversible.')
      .tag('Users')
      .pathParam('id', z.string().uuid(), 'User UUID')
      .noContent(204)
      .response(404, ErrorSchema, 'User not found')
  )

  .build();

// ─── Output ───────────────────────────────────────────────────────────────────

// 1. Full OpenAPI 3.1 JSON — for Swagger UI, Redoc, etc.
console.log('\n=== OpenAPI 3.1 JSON ===');
console.log(JSON.stringify(spec, null, 2).slice(0, 500) + '\n...');

// 2. OpenAI tool definitions — plug directly into your agent
console.log('\n=== OpenAI Tools (for GPT-4o, etc.) ===');
const openaiTools = toLLM.openai(spec);
console.log(JSON.stringify(openaiTools, null, 2).slice(0, 500) + '\n...');
console.log(`(${openaiTools.length} tools total)`);

// 3. Anthropic tool definitions — plug directly into Claude
console.log('\n=== Anthropic Tools (for Claude) ===');
const anthropicTools = toLLM.anthropic(spec);
console.log(JSON.stringify(anthropicTools, null, 2).slice(0, 500) + '\n...');
console.log(`(${anthropicTools.length} tools total)`);

// 4. Compact representation — paste into any LLM context
console.log('\n=== Compact LLM Context ===');
console.log(toLLM.compact(spec));

// ─── Usage Note ───────────────────────────────────────────────────────────────
//
// In a real Express app, you'd wire this up like:
//
//   import express from 'express';
//   import { spec } from './spec.js';
//   import swaggerUi from 'swagger-ui-express';
//
//   const app = express();
//   app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
//   app.get('/openapi.json', (req, res) => res.json(spec));
//
// The key: your route handlers use the SAME Zod schemas for validation:
//
//   app.post('/users', async (req, res) => {
//     const body = CreateUserSchema.parse(req.body); // ← same schema!
//     const user = await createUser(body);
//     res.status(201).json(user);
//   });
