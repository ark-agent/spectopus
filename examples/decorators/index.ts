/**
 * Decorator-based spectopus example
 *
 * For teams using class-based controllers (NestJS-style, etc.),
 * spectopus decorators let you colocate docs directly on the methods
 * they describe — even closer to the code than the fluent builder.
 *
 * The same runtime validation schema IS the documentation.
 * Change a schema → docs update. No lag, no drift.
 */

import { z } from 'zod';

// ─── Your domain schemas ───────────────────────────────────────────────────────
// These live in your domain layer and are used for BOTH:
//   • Runtime validation (Zod.parse)
//   • API documentation (spectopus reads them)
// Zero duplication. One schema to rule them all.

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string(),
  published: z.boolean().default(false),
  authorId: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200).describe('Post title (max 200 chars)'),
  content: z.string().min(1).describe('Post content (Markdown supported)'),
  published: z.boolean().optional().describe('Publish immediately'),
  tags: z.array(z.string()).optional().describe('Topic tags'),
});

export const UpdatePostSchema = CreatePostSchema.partial();

export const PostListSchema = z.object({
  posts: z.array(PostSchema),
  total: z.number().int(),
  page: z.number().int(),
});

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// ─── Decorator imports ────────────────────────────────────────────────────────

import {
  Controller,
  Get, Post, Put, Delete, Patch,
  Query, Path, Body,
  Response,
  Tag, Summary, Description, OperationId,
  extractControllerOperations,
} from '../../src/decorators/index.js';

import { SpecBuilder } from '../../src/builder/SpecBuilder.js';

// ─── Controller Definition ────────────────────────────────────────────────────

/**
 * Blog posts controller.
 *
 * Every decorator here serves double duty:
 * • @Get, @Post, etc. → document the HTTP method and path
 * • @Query, @Path, @Body → document and validate request input
 * • @Response → document what you'll return
 * • @Summary, @Description → prose documentation
 *
 * You'll never write a separate API doc for this controller.
 */
@Controller('/posts')
@Tag('Posts')
class PostController {
  // ─────────────────────────────────────────────────────────────────────────
  @Get()
  @OperationId('listPosts')
  @Summary('List posts')
  @Description('Returns paginated blog posts. Use `published=true` to show only published posts.')
  @Query('page', z.number().int().min(1).default(1), 'Page number')
  @Query('limit', z.number().int().min(1).max(50).default(10), 'Results per page')
  @Query('published', z.boolean().optional(), 'Filter by published status')
  @Query('tag', z.string().optional(), 'Filter by tag')
  @Response(200, PostListSchema, 'Post listing')
  @Response(400, ErrorSchema, 'Invalid parameters')
  async listPosts(): Promise<void> {
    // In a real app: const body = await validateQuery(req.query, ListPostsQuerySchema)
    // The schema above IS the docs. Runtime validation is separate but identical.
  }

  // ─────────────────────────────────────────────────────────────────────────
  @Post()
  @OperationId('createPost')
  @Summary('Create a post')
  @Description('Create a new blog post. Set `published: true` to publish immediately.')
  @Body(CreatePostSchema, 'Post content')
  @Response(201, PostSchema, 'Post created')
  @Response(400, ErrorSchema, 'Validation error')
  @Response(401, ErrorSchema, 'Unauthorized')
  async createPost(): Promise<void> {
    // Route handler implementation...
  }

  // ─────────────────────────────────────────────────────────────────────────
  @Get('/:id')
  @OperationId('getPostById')
  @Summary('Get post by ID')
  @Path('id', z.string().uuid(), 'Post UUID')
  @Response(200, PostSchema, 'Post found')
  @Response(404, ErrorSchema, 'Post not found')
  async getPostById(): Promise<void> {
    // Route handler implementation...
  }

  // ─────────────────────────────────────────────────────────────────────────
  @Patch('/:id')
  @OperationId('updatePost')
  @Summary('Update post')
  @Description('Partially update a post. Only provided fields are modified.')
  @Path('id', z.string().uuid(), 'Post UUID')
  @Body(UpdatePostSchema, 'Fields to update')
  @Response(200, PostSchema, 'Post updated')
  @Response(404, ErrorSchema, 'Post not found')
  async updatePost(): Promise<void> {
    // Route handler implementation...
  }

  // ─────────────────────────────────────────────────────────────────────────
  @Delete('/:id')
  @OperationId('deletePost')
  @Summary('Delete post')
  @Path('id', z.string().uuid(), 'Post UUID')
  @Response(204, undefined, 'Deleted')
  @Response(404, ErrorSchema, 'Not found')
  async deletePost(): Promise<void> {
    // Route handler implementation...
  }

  // ─────────────────────────────────────────────────────────────────────────
  @Put('/:id/publish')
  @OperationId('publishPost')
  @Summary('Publish a post')
  @Description('Set a post to published status. No body required.')
  @Path('id', z.string().uuid(), 'Post UUID')
  @Response(200, PostSchema, 'Post published')
  @Response(404, ErrorSchema, 'Post not found')
  async publishPost(): Promise<void> {
    // Route handler implementation...
  }
}

// ─── Extract and build spec ───────────────────────────────────────────────────

// Extract OpenAPI operations from the decorated controller
const postOps = extractControllerOperations(PostController as unknown as new () => PostController);

// Assemble into a full OpenAPI spec
let specBuilder = new SpecBuilder()
  .title('Blog API')
  .version('1.0.0')
  .description('A blog API where docs are written once, in the controller, never duplicated.')
  .server('https://blog.example.com/api', 'Production')
  .server('http://localhost:3000/api', 'Development')
  .bearerAuth()
  .tag('Posts', 'Blog post management')
  .component('Post', PostSchema)
  .component('Error', ErrorSchema);

// Add each extracted operation
for (const { path, method, operation } of postOps) {
  specBuilder = specBuilder.add(
    path,
    method as import('../../src/types/openapi3_1.js').HttpMethod,
    operation as never
  );
}

const spec = specBuilder.build();

console.log('=== Decorator-based spec ===');
console.log(`Paths: ${Object.keys(spec.paths ?? {}).join(', ')}`);
console.log(`Operations: ${postOps.length}`);
console.log('\nFull spec:');
console.log(JSON.stringify(spec, null, 2).slice(0, 800) + '\n...');
