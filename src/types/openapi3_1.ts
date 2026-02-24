/**
 * Complete TypeScript type definitions for OpenAPI 3.1 specification.
 * Based on the official OpenAPI 3.1.0 specification:
 * https://spec.openapis.org/oas/v3.1.0
 *
 * OpenAPI 3.1 aligns fully with JSON Schema Draft 2020-12.
 */

// ─── Reference Object ────────────────────────────────────────────────────────

/** A reference to another object in the spec using $ref */
export interface ReferenceObject {
  $ref: string;
  summary?: string;
  description?: string;
}

/** Helper type for objects that can be either a type T or a $ref */
export type RefOr<T> = T | ReferenceObject;

// ─── JSON Schema (OpenAPI 3.1 / JSON Schema 2020-12 aligned) ─────────────────

/**
 * Schema object for OpenAPI 3.1.
 * OpenAPI 3.1 uses JSON Schema 2020-12 as the canonical schema dialect.
 */
export interface SchemaObject {
  // JSON Schema keywords
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, SchemaObject>;

  // Type
  type?: SchemaType | SchemaType[];
  nullable?: boolean; // OpenAPI extension (deprecated in 3.1, use type arrays)

  // Composition
  allOf?: RefOr<SchemaObject>[];
  anyOf?: RefOr<SchemaObject>[];
  oneOf?: RefOr<SchemaObject>[];
  not?: RefOr<SchemaObject>;
  if?: RefOr<SchemaObject>;
  then?: RefOr<SchemaObject>;
  else?: RefOr<SchemaObject>;

  // Object keywords
  properties?: Record<string, RefOr<SchemaObject>>;
  additionalProperties?: boolean | RefOr<SchemaObject>;
  patternProperties?: Record<string, RefOr<SchemaObject>>;
  required?: string[];
  maxProperties?: number;
  minProperties?: number;
  unevaluatedProperties?: boolean | RefOr<SchemaObject>;

  // Array keywords
  items?: RefOr<SchemaObject> | false;
  prefixItems?: RefOr<SchemaObject>[];
  contains?: RefOr<SchemaObject>;
  minContains?: number;
  maxContains?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  unevaluatedItems?: boolean | RefOr<SchemaObject>;

  // String keywords
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: StringFormat | string;
  contentMediaType?: string;
  contentEncoding?: string;

  // Number keywords
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Enum / Const
  enum?: unknown[];
  const?: unknown;

  // Metadata
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;

  // OpenAPI specific
  discriminator?: DiscriminatorObject;
  xml?: XMLObject;
  externalDocs?: ExternalDocumentationObject;
  example?: unknown; // Deprecated in favor of examples

  // Allow extension fields
  [key: `x-${string}`]: unknown;
}

export type SchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export type StringFormat =
  | 'date'
  | 'date-time'
  | 'time'
  | 'duration'
  | 'email'
  | 'idn-email'
  | 'hostname'
  | 'idn-hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uri'
  | 'uri-reference'
  | 'iri'
  | 'iri-reference'
  | 'uuid'
  | 'uri-template'
  | 'json-pointer'
  | 'relative-json-pointer'
  | 'regex'
  | 'password'
  | 'byte'
  | 'binary';

// ─── Document Root ────────────────────────────────────────────────────────────

/** Root OpenAPI 3.1 document */
export interface OpenAPIDocument {
  /** REQUIRED. The version string for the OpenAPI Specification. */
  openapi: '3.1.0' | `3.1.${number}`;

  /** REQUIRED. Metadata about the API. */
  info: InfoObject;

  /** The default value for the $schema keyword within Schema Objects. */
  jsonSchemaDialect?: string;

  /** An array of Server Objects which provide connectivity information to a target server. */
  servers?: ServerObject[];

  /** The available paths and operations for the API. */
  paths?: PathsObject;

  /** The incoming webhooks that MAY be received as part of this API. */
  webhooks?: Record<string, RefOr<PathItemObject>>;

  /** An element to hold various schemas for the specification. */
  components?: ComponentsObject;

  /** A declaration of which security mechanisms can be used across the API. */
  security?: SecurityRequirementObject[];

  /** A list of tags used by the document with additional metadata. */
  tags?: TagObject[];

  /** Additional external documentation. */
  externalDocs?: ExternalDocumentationObject;

  // Extension fields
  [key: `x-${string}`]: unknown;
}

// ─── Info Object ─────────────────────────────────────────────────────────────

export interface InfoObject {
  /** REQUIRED. The title of the API. */
  title: string;

  /** A short summary of the API. */
  summary?: string;

  /** A description of the API. CommonMark syntax MAY be used. */
  description?: string;

  /** A URL to the Terms of Service for the API. */
  termsOfService?: string;

  /** The contact information for the exposed API. */
  contact?: ContactObject;

  /** The license information for the exposed API. */
  license?: LicenseObject;

  /** REQUIRED. The version of the OpenAPI document. */
  version: string;

  [key: `x-${string}`]: unknown;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
  [key: `x-${string}`]: unknown;
}

export interface LicenseObject {
  name: string;
  identifier?: string;
  url?: string;
  [key: `x-${string}`]: unknown;
}

// ─── Server Object ────────────────────────────────────────────────────────────

export interface ServerObject {
  /** REQUIRED. A URL to the target host. */
  url: string;

  /** An optional string describing the host designated by the URL. */
  description?: string;

  /** A map between a variable name and its value. */
  variables?: Record<string, ServerVariableObject>;

  [key: `x-${string}`]: unknown;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
  [key: `x-${string}`]: unknown;
}

// ─── Paths ───────────────────────────────────────────────────────────────────

/** Holds the relative paths to the individual endpoints and their operations. */
export type PathsObject = Record<string, RefOr<PathItemObject>>;

/** Describes the operations available on a single path. */
export interface PathItemObject {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: RefOr<ParameterObject>[];
  [key: `x-${string}`]: unknown;
}

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

// ─── Operation ───────────────────────────────────────────────────────────────

/** Describes a single API operation on a path. */
export interface OperationObject {
  /** A list of tags for API documentation control. */
  tags?: string[];

  /** A short summary of what the operation does. */
  summary?: string;

  /** A verbose explanation of the operation behavior. CommonMark syntax MAY be used. */
  description?: string;

  /** Additional external documentation for this operation. */
  externalDocs?: ExternalDocumentationObject;

  /**
   * Unique string used to identify the operation.
   * The id MUST be unique among all operations described in the API.
   */
  operationId?: string;

  /** A list of parameters that are applicable for this operation. */
  parameters?: RefOr<ParameterObject>[];

  /** The request body applicable for this operation. */
  requestBody?: RefOr<RequestBodyObject>;

  /** REQUIRED. The list of possible responses as they are returned from executing this operation. */
  responses?: ResponsesObject;

  /** A map of possible out-of-band callbacks related to the parent operation. */
  callbacks?: Record<string, RefOr<CallbackObject>>;

  /** Declares this operation to be deprecated. */
  deprecated?: boolean;

  /** A declaration of which security mechanisms can be used for this operation. */
  security?: SecurityRequirementObject[];

  /** An alternative server array to service this operation. */
  servers?: ServerObject[];

  [key: `x-${string}`]: unknown;
}

// ─── Parameter ───────────────────────────────────────────────────────────────

export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';

export interface ParameterObject {
  /** REQUIRED. The name of the parameter. */
  name: string;

  /** REQUIRED. The location of the parameter. */
  in: ParameterLocation;

  /** A brief description of the parameter. */
  description?: string;

  /** Determines whether this parameter is mandatory. */
  required?: boolean;

  /** Specifies that a parameter is deprecated. */
  deprecated?: boolean;

  /** Sets the ability to pass empty-valued parameters. */
  allowEmptyValue?: boolean;

  /** Describes how the parameter value will be serialized. */
  style?: ParameterStyle;

  /** When this is true, parameter values of type array or object generate separate parameters. */
  explode?: boolean;

  /** Determines whether the parameter value SHOULD allow reserved characters. */
  allowReserved?: boolean;

  /** The schema defining the type used for the parameter. */
  schema?: RefOr<SchemaObject>;

  /** Example of the parameter's potential value. */
  example?: unknown;

  /** Examples of the parameter's potential value. */
  examples?: Record<string, RefOr<ExampleObject>>;

  /** A map containing the representations for the parameter. */
  content?: Record<string, MediaTypeObject>;

  [key: `x-${string}`]: unknown;
}

export type ParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';

// ─── Request Body ─────────────────────────────────────────────────────────────

export interface RequestBodyObject {
  /** A brief description of the request body. */
  description?: string;

  /** REQUIRED. The content of the request body. */
  content: Record<string, MediaTypeObject>;

  /** Determines if the request body is required in the request. */
  required?: boolean;

  [key: `x-${string}`]: unknown;
}

// ─── Media Type ───────────────────────────────────────────────────────────────

export interface MediaTypeObject {
  /** The schema defining the content of the request, response, or parameter. */
  schema?: RefOr<SchemaObject>;

  /** Example of the media type. */
  example?: unknown;

  /** Examples of the media type. */
  examples?: Record<string, RefOr<ExampleObject>>;

  /** A map between a property name and its encoding information. */
  encoding?: Record<string, EncodingObject>;

  [key: `x-${string}`]: unknown;
}

export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, RefOr<HeaderObject>>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  [key: `x-${string}`]: unknown;
}

// ─── Responses ────────────────────────────────────────────────────────────────

export type ResponsesObject = Record<string, RefOr<ResponseObject>>;

export interface ResponseObject {
  /** REQUIRED. A description of the response. */
  description: string;

  /** Maps a header name to its definition. */
  headers?: Record<string, RefOr<HeaderObject>>;

  /** A map containing the descriptions of potential response payloads. */
  content?: Record<string, MediaTypeObject>;

  /** A map of operations links that can be followed from the response. */
  links?: Record<string, RefOr<LinkObject>>;

  [key: `x-${string}`]: unknown;
}

// ─── Example Object ───────────────────────────────────────────────────────────

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
  [key: `x-${string}`]: unknown;
}

// ─── Header Object ────────────────────────────────────────────────────────────

/** The Header Object follows the structure of the Parameter Object with some differences. */
export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'simple';
  explode?: boolean;
  allowReserved?: boolean;
  schema?: RefOr<SchemaObject>;
  example?: unknown;
  examples?: Record<string, RefOr<ExampleObject>>;
  content?: Record<string, MediaTypeObject>;
  [key: `x-${string}`]: unknown;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export interface TagObject {
  /** REQUIRED. The name of the tag. */
  name: string;

  /** A description for the tag. */
  description?: string;

  /** Additional external documentation for this tag. */
  externalDocs?: ExternalDocumentationObject;

  [key: `x-${string}`]: unknown;
}

// ─── External Documentation ───────────────────────────────────────────────────

export interface ExternalDocumentationObject {
  description?: string;
  url: string;
  [key: `x-${string}`]: unknown;
}

// ─── Components ───────────────────────────────────────────────────────────────

export interface ComponentsObject {
  schemas?: Record<string, RefOr<SchemaObject>>;
  responses?: Record<string, RefOr<ResponseObject>>;
  parameters?: Record<string, RefOr<ParameterObject>>;
  examples?: Record<string, RefOr<ExampleObject>>;
  requestBodies?: Record<string, RefOr<RequestBodyObject>>;
  headers?: Record<string, RefOr<HeaderObject>>;
  securitySchemes?: Record<string, RefOr<SecuritySchemeObject>>;
  links?: Record<string, RefOr<LinkObject>>;
  callbacks?: Record<string, RefOr<CallbackObject>>;
  pathItems?: Record<string, RefOr<PathItemObject>>;
  [key: `x-${string}`]: unknown;
}

// ─── Security ─────────────────────────────────────────────────────────────────

export type SecurityRequirementObject = Record<string, string[]>;

export type SecuritySchemeObject =
  | ApiKeySecurityScheme
  | HttpSecurityScheme
  | MutualTLSSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme;

export interface ApiKeySecurityScheme {
  type: 'apiKey';
  description?: string;
  name: string;
  in: 'query' | 'header' | 'cookie';
  [key: `x-${string}`]: unknown;
}

export interface HttpSecurityScheme {
  type: 'http';
  description?: string;
  scheme: string;
  bearerFormat?: string;
  [key: `x-${string}`]: unknown;
}

export interface MutualTLSSecurityScheme {
  type: 'mutualTLS';
  description?: string;
  [key: `x-${string}`]: unknown;
}

export interface OAuth2SecurityScheme {
  type: 'oauth2';
  description?: string;
  flows: OAuthFlowsObject;
  [key: `x-${string}`]: unknown;
}

export interface OpenIdConnectSecurityScheme {
  type: 'openIdConnect';
  description?: string;
  openIdConnectUrl: string;
  [key: `x-${string}`]: unknown;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
  [key: `x-${string}`]: unknown;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  [key: `x-${string}`]: unknown;
}

// ─── Link Object ──────────────────────────────────────────────────────────────

export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: ServerObject;
  [key: `x-${string}`]: unknown;
}

// ─── Callback Object ──────────────────────────────────────────────────────────

export type CallbackObject = Record<string, PathItemObject>;

// ─── Discriminator Object ─────────────────────────────────────────────────────

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
  [key: `x-${string}`]: unknown;
}

// ─── XML Object ───────────────────────────────────────────────────────────────

export interface XMLObject {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
  [key: `x-${string}`]: unknown;
}
