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
