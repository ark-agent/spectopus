/**
 * LLM Tools example — Turn your API spec into Claude/GPT tools in one line
 *
 * This is spectopus's killer feature for AI-native teams:
 * Your OpenAPI spec becomes a live, accurate tool manifest for LLMs.
 *
 * Because the spec is generated from your actual code (not manually maintained),
 * the LLM tools are always up-to-date. You can't accidentally give an LLM
 * stale function signatures.
 */

import { z } from 'zod';
import { SpecBuilder, OperationBuilder, toLLM } from '../../src/index.js';

// ─── Define your API using colocated schemas ───────────────────────────────────

const WeatherSchema = z.object({
  location: z.string().describe('City name or coordinates'),
  temperature: z.number().describe('Temperature in Celsius'),
  humidity: z.number().min(0).max(100).describe('Humidity percentage'),
  conditions: z.enum(['sunny', 'cloudy', 'rainy', 'snowy', 'windy']),
  forecast: z.array(z.object({
    date: z.string().date(),
    high: z.number(),
    low: z.number(),
    conditions: z.enum(['sunny', 'cloudy', 'rainy', 'snowy', 'windy']),
  })).optional(),
});

const SearchResultSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    snippet: z.string(),
    url: z.string().url(),
    score: z.number().min(0).max(1),
  })),
  total: z.number().int(),
  query: z.string(),
});

const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  description: z.string().optional(),
});

const ErrorSchema = z.object({ error: z.string(), code: z.string().optional() });

// ─── Build the spec ────────────────────────────────────────────────────────────

const spec = new SpecBuilder()
  .title('Agent Toolkit API')
  .version('1.0.0')
  .description('APIs designed for LLM agent consumption via function calling.')
  .server('https://api.myapp.com/v1', 'Production')
  .bearerAuth()
  .component('Weather', WeatherSchema)
  .component('SearchResult', SearchResultSchema)
  .component('CalendarEvent', CalendarEventSchema)
  .component('Error', ErrorSchema)

  // Weather tools
  .add('/weather/current', 'get',
    new OperationBuilder()
      .operationId('getCurrentWeather')
      .summary('Get current weather')
      .description('Get the current weather conditions for a location.')
      .tag('Weather')
      .query('location', z.string().describe('City name, zip code, or "lat,lon"'), 'Location', true)
      .query('units', z.enum(['celsius', 'fahrenheit']).default('celsius'), 'Temperature units')
      .response(200, '#/components/schemas/Weather', 'Current weather data')
      .response(404, ErrorSchema, 'Location not found')
  )
  .add('/weather/forecast', 'get',
    new OperationBuilder()
      .operationId('getWeatherForecast')
      .summary('Get weather forecast')
      .description('Get a multi-day weather forecast for a location.')
      .tag('Weather')
      .query('location', z.string(), 'Location query', true)
      .query('days', z.number().int().min(1).max(14).default(7), 'Number of forecast days')
      .response(200, '#/components/schemas/Weather', 'Forecast data')
      .response(404, ErrorSchema, 'Location not found')
  )

  // Search tools
  .add('/search', 'get',
    new OperationBuilder()
      .operationId('webSearch')
      .summary('Search the web')
      .description('Perform a web search and return ranked results.')
      .tag('Search')
      .query('q', z.string().min(1), 'Search query', true)
      .query('limit', z.number().int().min(1).max(20).default(10), 'Number of results')
      .query('type', z.enum(['web', 'news', 'images']).default('web'), 'Search type')
      .response(200, '#/components/schemas/SearchResult', 'Search results')
  )

  // Calendar tools
  .add('/calendar/events', 'get',
    new OperationBuilder()
      .operationId('listCalendarEvents')
      .summary('List calendar events')
      .description('Get upcoming calendar events within a date range.')
      .tag('Calendar')
      .query('startDate', z.string().datetime(), 'Range start (ISO 8601)', true)
      .query('endDate', z.string().datetime(), 'Range end (ISO 8601)', true)
      .query('calendarId', z.string().optional(), 'Specific calendar ID')
      .response(200, z.object({ events: z.array(CalendarEventSchema) }), 'Event listing')
  )
  .add('/calendar/events', 'post',
    new OperationBuilder()
      .operationId('createCalendarEvent')
      .summary('Create calendar event')
      .description('Schedule a new calendar event.')
      .tag('Calendar')
      .body(
        z.object({
          title: z.string().min(1).describe('Event title'),
          startTime: z.string().datetime().describe('Start time (ISO 8601)'),
          endTime: z.string().datetime().describe('End time (ISO 8601)'),
          location: z.string().optional().describe('Physical or virtual location'),
          attendees: z.array(z.string().email()).optional().describe('Attendee emails'),
          description: z.string().optional().describe('Event description or agenda'),
        }),
        'Event details'
      )
      .response(201, '#/components/schemas/CalendarEvent', 'Event created')
      .response(400, ErrorSchema, 'Validation error')
  )
  .add('/calendar/events/:id', 'delete',
    new OperationBuilder()
      .operationId('deleteCalendarEvent')
      .summary('Delete calendar event')
      .description('Cancel and remove a calendar event.')
      .tag('Calendar')
      .pathParam('id', z.string().uuid(), 'Event UUID')
      .noContent(204)
      .response(404, ErrorSchema, 'Event not found')
  )

  .build();

// ─── Export as OpenAI tools ────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  OPENAI TOOL DEFINITIONS');
console.log('  Ready for: openai.chat.completions.create({ tools: ... })');
console.log('═══════════════════════════════════════════════════════════\n');

const openaiTools = toLLM.openai(spec);
console.log(JSON.stringify(openaiTools, null, 2));

// ─── Export as Anthropic tools ────────────────────────────────────────────────

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  ANTHROPIC TOOL DEFINITIONS');
console.log('  Ready for: anthropic.messages.create({ tools: ... })');
console.log('═══════════════════════════════════════════════════════════\n');

const anthropicTools = toLLM.anthropic(spec);
console.log(JSON.stringify(anthropicTools, null, 2));

// ─── Export compact context ────────────────────────────────────────────────────

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  COMPACT SYSTEM PROMPT CONTEXT');
console.log('  Paste into your LLM system prompt — minimal tokens');
console.log('═══════════════════════════════════════════════════════════\n');

const compact = toLLM.compact(spec);
console.log(compact);

// ─── Usage with OpenAI ────────────────────────────────────────────────────────

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('  USAGE EXAMPLE (uncomment to run)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`
// With OpenAI:
import OpenAI from 'openai';
const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: "What's the weather in Tokyo?" }],
  tools: toLLM.openai(spec),  // ← one line, always accurate
});

// With Anthropic:
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: "Schedule a meeting tomorrow at 3pm" }],
  tools: toLLM.anthropic(spec),  // ← one line, always accurate
  max_tokens: 1024,
});
`);

console.log(`Summary: ${openaiTools.length} OpenAI tools, ${anthropicTools.length} Anthropic tools`);
console.log(`Compact context: ${compact.length} characters (~${Math.ceil(compact.length / 4)} tokens)`);
