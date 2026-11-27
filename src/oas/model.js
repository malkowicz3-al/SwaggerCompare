// OpenAPI 3.0 / 3.1 / 3.2 knowledge as data. Versions are numbers: 3.M.x -> 30 + M.
// Field: {t, of?, doc, req?, reqUntil?, since?, until?, enum?, hints?, keyHints?, tFrom?}
//   t: 'str'|'num'|'int'|'bool'|'any'|'obj'|'map'|'list', alternatives joined with '|'
//   since inclusive, until exclusive; enum items may be [value, since, until]

export const TEMPLATES = ['3.0.3', '3.1.1', '3.2.0'];

const s = (doc, x) => ({ t: 'str', doc, ...x });
const b = (doc, x) => ({ t: 'bool', doc, ...x });
const n = (doc, x) => ({ t: 'num', doc, ...x });
const i = (doc, x) => ({ t: 'int', doc, ...x });
const a = (doc, x) => ({ t: 'any', doc, ...x });
const o = (of, doc, x) => ({ t: 'obj', of, doc, ...x });
const m = (of, doc, x) => ({ t: 'map', of, doc, ...x });
const l = (of, doc, x) => ({ t: 'list', of, doc, ...x });

const STATUS = ['200', '201', '204', '400', '401', '403', '404', '409', '422', '500', 'default'];
const MEDIA = ['application/json', 'application/xml', 'text/plain', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/octet-stream'];
const FORMATS = ['int32', 'int64', 'float', 'double', 'byte', 'binary', 'date', 'date-time', 'password', 'email', 'uri', 'uuid'];
const content = (doc) => m('MediaType', doc, { keyHints: MEDIA });
const op = (name) => o('Operation', `The ${name.toUpperCase()} operation on this path.`);

const schemaRef = (doc, x) => o('Schema', doc, x);

export const OBJECTS = {
  OpenAPI: {
    doc: 'The root object of an OpenAPI document.',
    fields: {
      openapi: s('The OpenAPI Specification version this document uses.', { req: true, hints: TEMPLATES }),
      $self: s('The URI that identifies this document, used as the base for relative references.', { since: 32 }),
      info: o('Info', 'Metadata about the API.', { req: true }),
      jsonSchemaDialect: s('The default JSON Schema dialect URI for Schema Objects in this document.', { since: 31 }),
      servers: l('Server', 'The servers that host the API.'),
      paths: o('Paths', 'The available paths and their operations.', { req: true, reqUntil: 31 }),
      webhooks: m('PathItem', 'Incoming requests the API consumer may receive, keyed by name.', { since: 31 }),
      components: o('Components', 'Reusable objects referenced from elsewhere in the document.'),
      security: l('SecurityRequirement', 'Security requirements that apply to every operation by default.'),
      tags: l('Tag', 'Tags used to group operations, with extra metadata.'),
      externalDocs: o('ExternalDocs', 'A link to additional external documentation.'),
    },
  },
  Info: {
    doc: 'Metadata about the API.',
    fields: {
      title: s('The name of the API.', { req: true }),
      summary: s('A short summary of the API.', { since: 31 }),
      description: s('A longer description of the API; CommonMark is allowed.'),
      termsOfService: s('A URL to the terms of service of the API.'),
      contact: o('Contact', 'Contact information for the API.'),
      license: o('License', 'License information for the API.'),
      version: s('The version of this API document (not the OpenAPI version).', { req: true }),
    },
  },
  Contact: {
    doc: 'Contact information for the API.',
    fields: {
      name: s('The name of the contact person or organization.'),
      url: s('A URL pointing to the contact information.'),
      email: s('The email address of the contact.'),
    },
  },
  License: {
    doc: 'License information for the API.',
    fields: {
      name: s('The name of the license.', { req: true }),
      identifier: s('An SPDX license expression for the API.', { since: 31 }),
      url: s('A URL to the license text.'),
    },
  },
  Server: {
    doc: 'A server that hosts the API.',
    fields: {
      url: s('The server URL, which may contain {variables}.', { req: true }),
      description: s('A description of the server.'),
      name: s('A short name for the server.', { since: 32 }),
      variables: m('ServerVariable', 'Values for the variables in the server URL.'),
    },
  },
  ServerVariable: {
    doc: 'A variable used in a server URL template.',
    fields: {
      enum: l('str', 'The allowed values of the variable.'),
      default: s('The value used when no other value is supplied.', { req: true }),
      description: s('A description of the variable.'),
    },
  },
  Paths: {
    doc: 'The available paths, each starting with a slash.',
    fields: {},
    patterns: [{ re: /^\//, t: 'obj', of: 'PathItem', doc: 'The operations available on this path.' }],
  },
  PathItem: {
    doc: 'The operations available on a single path.',
    ref: true,
    fields: {
      summary: s('A short summary that applies to all operations on this path.'),
      description: s('A description that applies to all operations on this path.'),
      get: op('get'), put: op('put'), post: op('post'), delete: op('delete'),
      options: op('options'), head: op('head'), patch: op('patch'), trace: op('trace'),
      query: o('Operation', 'The QUERY operation on this path, a safe request that carries a body.', { since: 32 }),
      additionalOperations: m('Operation', 'Operations for other HTTP methods, keyed by the method name in upper case.', { since: 32 }),
      servers: l('Server', 'Servers that override the global ones for this path.'),
      parameters: l('Parameter', 'Parameters shared by all operations on this path.'),
    },
  },
  Operation: {
    doc: 'A single API operation on a path.',
    fields: {
      tags: l('str', 'Tags used to group this operation.'),
      summary: s('A short summary of what the operation does.'),
      description: s('A longer explanation of the operation behavior.'),
      externalDocs: o('ExternalDocs', 'A link to additional documentation for this operation.'),
      operationId: s('A unique identifier for the operation.'),
      parameters: l('Parameter', 'Parameters accepted by this operation.'),
      requestBody: o('RequestBody', 'The body this operation accepts.'),
      responses: o('Responses', 'The possible responses, keyed by status code.', { req: true, reqUntil: 31 }),
      callbacks: m('Callback', 'Out-of-band callbacks related to this operation.'),
      deprecated: b('Marks the operation as deprecated.'),
      security: l('SecurityRequirement', 'Security requirements that override the document default.'),
      servers: l('Server', 'Servers that override the global ones for this operation.'),
    },
  },
  Parameter: {
    doc: 'A single operation parameter, identified by name and location.',
    ref: true,
    fields: {
      name: s('The name of the parameter, case sensitive.', { req: true }),
      in: s('Where the parameter is sent.', { req: true, enum: ['query', 'header', 'path', 'cookie', ['querystring', 32]] }),
      description: s('A description of the parameter.'),
      required: b('Whether the parameter is mandatory; path parameters must set it to true.'),
      deprecated: b('Marks the parameter as deprecated.'),
      allowEmptyValue: b('Allows sending a query parameter with an empty value.'),
      style: s('How the parameter value is serialized.', { enum: ['matrix', 'label', 'simple', 'form', 'spaceDelimited', 'pipeDelimited', 'deepObject', ['cookie', 32]] }),
      explode: b('Whether arrays and objects produce a separate parameter per item.'),
      allowReserved: b('Whether reserved characters are sent without percent-encoding.'),
      schema: schemaRef('The schema of the parameter value.'),
      example: a('An example value of the parameter.'),
      examples: m('Example', 'Named examples of the parameter value.'),
      content: content('The parameter representation, keyed by a single media type.'),
    },
  },
  RequestBody: {
    doc: 'The body of a request.',
    ref: true,
    fields: {
      description: s('A description of the request body.'),
      content: content('The body content, keyed by media type.', ),
      required: b('Whether the body is mandatory.'),
    },
  },
  MediaType: {
    doc: 'The schema and examples for one media type.',
    ref: true,
    fields: {
      schema: schemaRef('The schema of the content.'),
      itemSchema: schemaRef('The schema of each item in a sequential media type such as JSON Lines.', { since: 32 }),
      example: a('An example of the content.'),
      examples: m('Example', 'Named examples of the content.'),
      encoding: m('Encoding', 'Encoding of individual properties, keyed by property name.'),
      prefixEncoding: l('Encoding', 'Encoding of the leading items of a multipart body, by position.', { since: 32 }),
      itemEncoding: o('Encoding', 'Encoding applied to every item of a multipart body.', { since: 32 }),
    },
  },
  Encoding: {
    doc: 'How a single property of a multipart or form body is encoded.',
    fields: {
      contentType: s('The content type of the property.'),
      headers: m('Header', 'Extra headers for a multipart part.'),
      style: s('How the property value is serialized.', { enum: ['form', 'spaceDelimited', 'pipeDelimited', 'deepObject'] }),
      explode: b('Whether arrays and objects produce a separate value per item.'),
      allowReserved: b('Whether reserved characters are sent without percent-encoding.'),
      encoding: m('Encoding', 'Encoding of nested properties, keyed by property name.', { since: 32 }),
      prefixEncoding: l('Encoding', 'Encoding of the leading nested items, by position.', { since: 32 }),
      itemEncoding: o('Encoding', 'Encoding applied to every nested item.', { since: 32 }),
    },
  },
  Responses: {
    doc: 'The possible responses of an operation, keyed by HTTP status code.',
    fields: {
      default: o('Response', 'The response for any status code not listed explicitly.'),
    },
    patterns: [{ re: /^[1-5](?:\d\d|XX)$/, t: 'obj', of: 'Response', doc: 'The response for this HTTP status code.', keyHints: STATUS }],
  },
  Response: {
    doc: 'A single response of an operation.',
    ref: true,
    fields: {
      summary: s('A short summary of the response.', { since: 32 }),
      description: s('A description of the response.', { req: true, reqUntil: 32 }),
      headers: m('Header', 'Response headers, keyed by header name.'),
      content: content('The response body, keyed by media type.'),
      links: m('Link', 'Links to other operations, keyed by name.'),
    },
  },
  Header: {
    doc: 'A header sent with a request or response.',
    ref: true,
    fields: {
      description: s('A description of the header.'),
      required: b('Whether the header is mandatory.'),
      deprecated: b('Marks the header as deprecated.'),
      allowEmptyValue: b('Allows an empty header value.'),
      style: s('How the header value is serialized.', { enum: ['simple'] }),
      explode: b('Whether arrays and objects produce a separate value per item.'),
      allowReserved: b('Whether reserved characters are sent without percent-encoding.'),
      schema: schemaRef('The schema of the header value.'),
      example: a('An example of the header value.'),
      examples: m('Example', 'Named examples of the header value.'),
      content: content('The header representation, keyed by a single media type.'),
    },
  },
  Components: {
    doc: 'Reusable objects that other parts of the document reference.',
    fields: {
      schemas: m('Schema', 'Reusable schemas, keyed by name.'),
      responses: m('Response', 'Reusable responses, keyed by name.'),
      parameters: m('Parameter', 'Reusable parameters, keyed by name.'),
      examples: m('Example', 'Reusable examples, keyed by name.'),
      requestBodies: m('RequestBody', 'Reusable request bodies, keyed by name.'),
      headers: m('Header', 'Reusable headers, keyed by name.'),
      securitySchemes: m('SecurityScheme', 'Reusable security schemes, keyed by name.'),
      links: m('Link', 'Reusable links, keyed by name.'),
      callbacks: m('Callback', 'Reusable callbacks, keyed by name.'),
      pathItems: m('PathItem', 'Reusable path items, keyed by name.', { since: 31 }),
      mediaTypes: m('MediaType', 'Reusable media type objects, keyed by name.', { since: 32 }),
    },
  },
  Schema: {
    doc: 'A data type definition based on JSON Schema.',
    ref: true,
    fields: {
      title: s('A short title for the schema.'),
      description: s('A description of the data.'),
      type: s('The data type.', { of: 'str', enum: ['string', 'number', 'integer', 'boolean', 'array', 'object', ['null', 31]], tFrom: [31, 'str|list'] }),
      format: s('A hint about the exact data format, such as int64 or date-time.', { hints: FORMATS }),
      enum: l('any', 'The fixed set of allowed values.'),
      const: a('The single allowed value.', { since: 31 }),
      default: a('The value assumed when none is supplied.'),
      nullable: b('Allows null in addition to the declared type.', { until: 31 }),
      multipleOf: n('The number must be a multiple of this value.'),
      maximum: n('The inclusive upper bound of a number.'),
      exclusiveMaximum: b('Makes maximum exclusive.', { tFrom: [31, 'num'] }),
      minimum: n('The inclusive lower bound of a number.'),
      exclusiveMinimum: b('Makes minimum exclusive.', { tFrom: [31, 'num'] }),
      maxLength: i('The maximum length of a string.'),
      minLength: i('The minimum length of a string.'),
      pattern: s('A regular expression the string must match.'),
      maxItems: i('The maximum number of array items.'),
      minItems: i('The minimum number of array items.'),
      uniqueItems: b('Requires all array items to be distinct.'),
      maxProperties: i('The maximum number of object properties.'),
      minProperties: i('The minimum number of object properties.'),
      required: l('str', 'The names of properties that must be present.'),
      properties: m('Schema', 'The schemas of the object properties, keyed by name.'),
      additionalProperties: { t: 'bool|obj', of: 'Schema', doc: 'The schema for properties not listed, or false to forbid them.' },
      patternProperties: m('Schema', 'Schemas for properties whose names match a regular expression.', { since: 31 }),
      propertyNames: schemaRef('A schema every property name must match.', { since: 31 }),
      unevaluatedProperties: { t: 'bool|obj', of: 'Schema', doc: 'The schema for properties no other keyword evaluated.', since: 31 },
      dependentRequired: a('Properties that become required when a given property is present.', { since: 31 }),
      dependentSchemas: m('Schema', 'Schemas that apply when a given property is present.', { since: 31 }),
      items: schemaRef('The schema of the array items.', { tFrom: [31, 'obj|bool'] }),
      prefixItems: l('Schema', 'Schemas for the leading array items, by position.', { since: 31 }),
      unevaluatedItems: { t: 'bool|obj', of: 'Schema', doc: 'The schema for array items no other keyword evaluated.', since: 31 },
      contains: schemaRef('A schema at least one array item must match.', { since: 31 }),
      minContains: i('The minimum number of items that match contains.', { since: 31 }),
      maxContains: i('The maximum number of items that match contains.', { since: 31 }),
      allOf: l('Schema', 'The data must match all of these schemas.'),
      oneOf: l('Schema', 'The data must match exactly one of these schemas.'),
      anyOf: l('Schema', 'The data must match at least one of these schemas.'),
      not: schemaRef('The data must not match this schema.'),
      if: schemaRef('A condition schema that selects then or else.', { since: 31 }),
      then: schemaRef('The schema applied when if matches.', { since: 31 }),
      else: schemaRef('The schema applied when if does not match.', { since: 31 }),
      discriminator: o('Discriminator', 'Selects the matching oneOf/anyOf schema from a property value.'),
      readOnly: b('The property is only sent in responses.'),
      writeOnly: b('The property is only sent in requests.'),
      xml: o('XML', 'Details for the XML representation.'),
      externalDocs: o('ExternalDocs', 'A link to additional documentation for this schema.'),
      example: a('An example value of the schema.'),
      examples: l('any', 'A list of example values of the schema.', { since: 31 }),
      deprecated: b('Marks the schema as deprecated.'),
      contentMediaType: s('The media type of string content.', { since: 31 }),
      contentEncoding: s('The encoding of string content, such as base64.', { since: 31 }),
      contentSchema: schemaRef('The schema of the decoded string content.', { since: 31 }),
      $id: s('The URI that identifies this schema.', { since: 31 }),
      $schema: s('The JSON Schema dialect of this schema.', { since: 31 }),
      $anchor: s('A plain-name anchor for referencing this schema.', { since: 31 }),
      $dynamicAnchor: s('A dynamic anchor for extensible recursive schemas.', { since: 31 }),
      $dynamicRef: s('A reference resolved through dynamic anchors.', { since: 31 }),
      $defs: m('Schema', 'Local schema definitions, keyed by name.', { since: 31 }),
      $comment: s('A comment for schema authors, ignored by tools.', { since: 31 }),
    },
  },
  Discriminator: {
    doc: 'Tells which schema applies based on the value of one property.',
    fields: {
      propertyName: s('The property whose value selects the schema.', { req: true }),
      mapping: m('str', 'Maps property values to schema names or references.'),
      defaultMapping: s('The schema used when the property value has no mapping.', { since: 32 }),
    },
  },
  XML: {
    doc: 'Details for the XML representation of a schema.',
    fields: {
      nodeType: s('The kind of XML node this schema maps to.', { since: 32, enum: ['element', 'attribute', 'text', 'cdata', 'none'] }),
      name: s('The element or attribute name.'),
      namespace: s('The absolute URI of the XML namespace.'),
      prefix: s('The namespace prefix.'),
      attribute: b('Writes the property as an attribute instead of an element.'),
      wrapped: b('Wraps array items in an extra element.'),
    },
  },
  Example: {
    doc: 'A named example value.',
    ref: true,
    fields: {
      summary: s('A short summary of the example.'),
      description: s('A longer description of the example.'),
      value: a('The example value inline.'),
      dataValue: a('The example as data, before serialization.', { since: 32 }),
      serializedValue: s('The example exactly as sent on the wire.', { since: 32 }),
      externalValue: s('A URL to the example value.'),
    },
  },
  Link: {
    doc: 'A link from a response to another operation.',
    ref: true,
    fields: {
      operationRef: s('A URI reference to the linked operation.'),
      operationId: s('The operationId of the linked operation.'),
      parameters: a('Parameter values for the linked operation, keyed by name.'),
      requestBody: a('The request body for the linked operation.'),
      description: s('A description of the link.'),
      server: o('Server', 'A server that overrides the target operation servers.'),
    },
  },
  Callback: {
    doc: 'Requests the API may send back, keyed by a runtime URL expression.',
    ref: true,
    fields: {},
    patterns: [{ re: /^/, t: 'obj', of: 'PathItem', doc: 'The request sent to the URL given by this expression.' }],
  },
  SecurityRequirement: {
    doc: 'The security schemes required, each mapped to its list of scopes.',
    fields: {},
    patterns: [{ re: /^/, t: 'list', of: 'str', doc: 'The scopes required from this security scheme.' }],
  },
  SecurityScheme: {
    doc: 'A security scheme the operations can use.',
    ref: true,
    fields: {
      type: s('The kind of security scheme.', { req: true, enum: ['apiKey', 'http', 'oauth2', 'openIdConnect', ['mutualTLS', 31]] }),
      description: s('A description of the security scheme.'),
      name: s('The name of the header, query or cookie parameter for apiKey.'),
      in: s('Where the API key is sent.', { enum: ['query', 'header', 'cookie'] }),
      scheme: s('The HTTP authorization scheme, such as bearer.', { hints: ['basic', 'bearer', 'digest'] }),
      bearerFormat: s('A hint about the bearer token format, such as JWT.'),
      flows: o('OAuthFlows', 'The OAuth flows the scheme supports.'),
      openIdConnectUrl: s('The OpenID Connect discovery URL.'),
      oauth2MetadataUrl: s('The OAuth 2.0 authorization server metadata URL.', { since: 32 }),
      deprecated: b('Marks the security scheme as deprecated.', { since: 32 }),
    },
  },
  OAuthFlows: {
    doc: 'The OAuth flows a scheme supports.',
    fields: {
      implicit: o('OAuthFlow', 'The implicit flow.'),
      password: o('OAuthFlow', 'The resource owner password flow.'),
      clientCredentials: o('OAuthFlow', 'The client credentials flow.'),
      authorizationCode: o('OAuthFlow', 'The authorization code flow.'),
      deviceAuthorization: o('OAuthFlow', 'The device authorization flow.', { since: 32 }),
    },
  },
  OAuthFlow: {
    doc: 'The settings of one OAuth flow.',
    fields: {
      authorizationUrl: s('The authorization endpoint URL.'),
      deviceAuthorizationUrl: s('The device authorization endpoint URL.', { since: 32 }),
      tokenUrl: s('The token endpoint URL.'),
      refreshUrl: s('The URL for refreshing tokens.'),
      scopes: m('str', 'The available scopes, each mapped to a short description.', { req: true }),
    },
  },
  Tag: {
    doc: 'Metadata for a tag used by operations.',
    fields: {
      name: s('The tag name.', { req: true }),
      summary: s('A short summary of the tag.', { since: 32 }),
      description: s('A description of the tag.'),
      externalDocs: o('ExternalDocs', 'A link to additional documentation for this tag.'),
      parent: s('The name of the tag this one is nested under.', { since: 32 }),
      kind: s('The category of the tag, such as nav or badge.', { since: 32, hints: ['nav', 'badge', 'audience'] }),
    },
  },
  ExternalDocs: {
    doc: 'A link to external documentation.',
    fields: {
      description: s('A description of the linked documentation.'),
      url: s('The URL of the documentation.', { req: true }),
    },
  },
};

const REF = s('A reference to an object defined elsewhere.');
export const EXT = a('Specification extension: a custom field that tools may use.');

export function verOf(text) {
  const mm = /(?:^['"]?|")openapi['"]?\s*:\s*['"]?3\.(\d+)/m.exec(text);
  return mm ? 30 + Number(mm[1]) : undefined;
}

export const active = (f, ver) => (!f.since || ver >= f.since) && (!f.until || ver < f.until);

export const kindsOf = (f, ver) => (f.tFrom && ver >= f.tFrom[0] ? f.tFrom[1] : f.t).split('|');

// active enum values; [value, since, until] items are gated
export const enumOf = (f, ver) => f.enum?.filter((e) => !Array.isArray(e) || active({ since: e[1], until: e[2] }, ver)).map((e) => (Array.isArray(e) ? e[0] : e));

export function member(type, key, ver) {
  const obj = OBJECTS[type];
  if (!obj) return undefined;
  if (Object.hasOwn(obj.fields, key)) {
    const f = obj.fields[key];
    return active(f, ver) ? { spec: f, via: 'field' } : { spec: f, via: 'field', gated: true };
  }
  if (key === '$ref' && obj.ref) return { spec: REF, via: 'field' };
  if (key.startsWith('x-')) return { spec: EXT, via: 'pattern' };
  const p = obj.patterns?.find((p) => p.re.test(key));
  return p ? { spec: p, via: 'pattern' } : undefined;
}

// the spec of one entry of a map or list field
export const itemSpec = (f) => (OBJECTS[f.of] ? { t: 'obj', of: f.of, doc: OBJECTS[f.of].doc } : { t: f.of ?? 'any', doc: f.doc, enum: f.enum });

const nodeOf = (spec, ver) => {
  const kinds = kindsOf(spec, ver);
  const kind = kinds.find((k) => k === 'obj' || k === 'map' || k === 'list');
  return kind ? { kind, type: spec.of, spec } : { kind: 'prim', type: kinds[0], spec };
};

// path of keys (strings) and item indexes (numbers) from the root -> what lives there
export function typeAt(path, ver) {
  let cur = { kind: 'obj', type: 'OpenAPI', spec: null };
  for (const seg of path) {
    if (cur.kind === 'obj') {
      const mm = member(cur.type, String(seg), ver);
      if (!mm) return null;
      cur = nodeOf(mm.spec, ver);
    } else if (cur.kind === 'map' || (cur.kind === 'list' && typeof seg === 'number')) {
      cur = nodeOf(itemSpec(cur.spec), ver);
    } else return null;
  }
  return cur;
}

// the components section a $ref in an object of this type points into
export const refKind = (type, ver) => Object.entries(OBJECTS.Components.fields).find(([, f]) => f.of === type && active(f, ver))?.[0];
