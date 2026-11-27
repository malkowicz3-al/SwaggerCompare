// starter(ver) -> a small valid document for '3.0.3' | '3.1.1' | '3.2.0'
export function starter(ver) {
  const minor = Number(ver.split('.')[1]);
  const lines = [
    `openapi: ${ver}`,
    minor >= 2 && '$self: https://api.example.com/openapi.yaml',
    'info:',
    '  title: Example API',
    minor >= 1 && '  summary: A starter API with one endpoint',
    '  version: 1.0.0',
    'servers:',
    '  - url: https://api.example.com/v1',
    'paths:',
    '  /items:',
    '    get:',
    '      summary: List items',
    '      operationId: listItems',
    '      responses:',
    "        '200':",
    '          description: The items',
    '          content:',
    '            application/json:',
    '              schema:',
    '                type: array',
    '                items:',
    "                  $ref: '#/components/schemas/Item'",
    'components:',
    '  schemas:',
    '    Item:',
    '      type: object',
    '      required: [id]',
    '      properties:',
    '        id:',
    '          type: string',
    '        note:',
    ...(minor >= 1 ? ["          type: [string, 'null']"] : ['          type: string', '          nullable: true']),
  ];
  return lines.filter((l) => l !== false).join('\n') + '\n';
}

// YAML snippets in Monaco syntax: lines use a relative 2-space indent; complete.js adds the cursor's indent
export const SNIPPETS = [
  { label: 'path', doc: 'A path with a GET operation.', lines: ['/${1:items}:', '  get:', '    summary: ${2:List items}', '    operationId: ${3:listItems}', '    responses:', "      '200':", '        description: ${4:OK}'] },
  // the method choice is filled in by complete.js with the methods still free
  { label: 'operation', doc: 'An operation with a summary, an operationId and a response.', lines: ['${1|METHODS|}:', '  summary: ${2:Summary}', '  operationId: ${3:operationId}', '  responses:', "    '200':", '      description: ${4:OK}'] },
  { label: 'parameter: query', doc: 'A query parameter.', lines: ['name: ${1:limit}', 'in: query', 'schema:', '  type: ${2:integer}'] },
  { label: 'parameter: path', doc: 'A path parameter.', lines: ['name: ${1:id}', 'in: path', 'required: true', 'schema:', '  type: ${2:string}'] },
  { label: 'parameter: header', doc: 'A header parameter.', lines: ['name: ${1:X-Request-Id}', 'in: header', 'schema:', '  type: ${2:string}'] },
  { label: 'response', doc: 'A response with a JSON body.', lines: ["'${1:200}':", '  description: ${2:OK}', '  content:', '    application/json:', '      schema:', '        type: ${3:object}'] },
  { label: 'schema', doc: 'An object schema with one required property.', lines: ['${1:Name}:', '  type: object', '  required: [${2:id}]', '  properties:', '    ${2:id}:', '      type: ${3:string}'] },
];
