# B2: `$ref` support, semantic rules, snippets and "Compare with…" (v1.9.0), implementation plan

This builds on B1 (`docs/plans/b1-editor-core.md`, already released).

## Decisions
- **Parameters.** A path-level and an operation-level parameter with the same `in` and `name` merge, and the operation one wins. A duplicate is flagged only within a single list.
- **Tags.** The tag rule runs only when the root has a `tags` key. Specs without top-level tags get no notes.
- **"Compare with…"** replaces Original with the baseline text when there is one. This can be undone with Ctrl+Z, so there is no confirm.
- **Data fields.** `$ref` inside `any`-typed fields (`example`, `default`, `const`, `value`) is data, not a reference.
- **SecurityScheme.** It may get `$ref` completion pointing to `securitySchemes`; that is valid.

## Changes
- **`src/compare.js`:** export `pointer`. No other change.
- **`src/oas/model.js`:** `export const refKind = (type, ver) => Object.entries(OBJECTS.Components.fields).find(([, f]) => f.of === type && active(f, ver))?.[0];`
  - Results: Parameter → `parameters`, Schema → `schemas`, PathItem → `pathItems` (3.1+), MediaType → `mediaTypes` (3.2+).
- **`src/oas/outline.js`:** export `METHODS`.
- **`src/oas/ast.js`:**
  - `lookup(root, segs)` → `{pair?, node} | undefined`: a map uses `pairOf`, a sequence uses `items[Number(seg)]`, and the last pair is kept so `pair.key.range` is available.
  - `deref(root, node)`: follows a map holding a local string `$ref`, at most 10 hops, using `pointer` and `lookup`. Returns the target node or `undefined`.
- **`src/oas/refs.js` (new, pure):**
  - `refAt(text, line, col)` → `{ref, from, to} | null`.
    - Matches one line with `/(["']?)\$ref\1\s*:\s*(["'])?(#[^"'\s,}]*)\2?/g`.
    - `from` and `to` are 1-based columns of the value without its quotes. It hits when `from <= col <= to`.
  - `targets(root, kind)` → the key names of `components.<kind>`; an empty list if the section is missing.
  - `definitionAt(text, line, col)` → `{line, col} | null`.
    - Steps: `refAt`, then `pointer` (external refs and a bare `#` give `null`), then `parse`, then `lookup`.
    - The position is the start of the target's key, or `node.range[0]` for a sequence item.
  - `refHover(text, line, col)` → `{title, kind, rows: string[], from, to} | null`.
    - The target comes from `deref` plus `toJS`.
    - Schema rows: title, description (cut to ~120 characters), type, and the first 5 properties as `name: type`.
    - Parameter rows: `in: x`, `required: true`.
    - Anything else: summary or description.
    - `title` is the last pointer segment; `kind` is `segs[1]` under `components`.
- **`src/oas/complete.js`:**
  - **`$ref` value:** applies when `ctx.key === '$ref'` and `refKind(ctx.objectType, ver)` exists.
    - Each name gives `label = '#/components/<kind>/<name>'`, with the name escaped: `~` becomes `~0`, `/` becomes `~1`.
    - `insertText` is the label in quotes: `'…'` in YAML, `"…"` in JSON. Keep the existing leading-space rule after `:`.
    - Filter with `includes` (not `startsWith`), so typing the bare name works. Deduplicate.
  - **`$ref` key:** offered when `obj.ref` is set and `$ref` is not already present. The item carries `retrigger: true`.
  - **Snippets** (YAML only). The bodies live in `templates.js` as `export const SNIPPETS`.
    - Each snippet is `{label, doc, lines}`, with relative 2-space indent and `\$` for a literal `$`.
    - `render` builds `insertText = lines.join('\n' + pad)`, using the same `pad` as `insertKey`.
    - In a list without a dash (`dashed`), the first line gets `- ` and the other lines get a 2-space prefix.
    - Items are `{kind: 'snippet', snippet: true, sortText: '2' + label}`.
  - **Where each snippet is offered:**

    | Context | Snippet |
    |---|---|
    | `objectType === 'Paths'` | `path` |
    | `objectType === 'PathItem'` | `operation` (only methods not yet present; `query` from 3.2 on) |
    | `objectType === 'Responses'` | `response` |
    | `path` ends with `components`, `schemas` (not `properties`) | `schema` |
    | an empty item after `- ` (`objectType === 'Parameter'`, no keys present, `/^\s*- +[\w"']*$/` before the cursor) | `parameter: query`, `parameter: path`, `parameter: header` |
    | directly under `parameters:` (a list container of Parameter) | the same three, `dashed` |

  - **Snippet bodies:**
    - `path`: `/${1:items}:` / `  get:` / `    summary: ${2:List items}` / `    operationId: ${3:listItems}` / `    responses:` / `      '200':` / `        description: ${4:OK}`
    - `operation`: `${1|get,post,put,patch,delete|}:` (only methods still free) / `  summary: ${2:Summary}` / `  operationId: ${3:operationId}` / `  responses:` / `    '200':` / `      description: ${4:OK}`
    - `parameter: query`: `name: ${1:limit}` / `in: query` / `schema:` / `  type: ${2:integer}`
    - `parameter: path`: `name: ${1:id}` / `in: path` / `required: true` / `schema:` / `  type: ${2:string}`
    - `parameter: header`: `name: ${1:X-Request-Id}` / `in: header` / `schema:` / `  type: ${2:string}`
    - `response`: `'${1:200}':` / `  description: ${2:OK}` / `  content:` / `    application/json:` / `      schema:` / `        type: ${3:object}`
    - `schema`: `${1:Name}:` / `  type: object` / `  required: [${2:id}]` / `  properties:` / `    ${2:id}:` / `      type: ${3:string}`
- **`src/oas/validate.js`:**
  - **Shared walk:** `collect(ctx)` runs once per document, memoised as `ctx.sem ??= collect(ctx)`. Every new rule first returns `[]` if there are doc errors, no version, or the root is not a map. The walk:
    - recurses with the `path` and the `keyPair`, calling `typeAt` once per map;
    - collects:
      - `sites` (a scalar-string `$ref` with its value node, path and the slot type);
      - `ops` (Operation maps);
      - `items` (PathItem under `paths`, with its path key);
      - `servers`;
      - `secUses` (the pairs of each SecurityRequirement);
      - discriminator mapping edges;
    - skips `<<` keys and any `member()` whose spec has `t === 'any'`.
  - Position helpers: `at = (ctx, node) => range(ctx.lc, head(ctx.text, node.range))`; a key position is `range(ctx.lc, pair.key.range)`.
  - **The rules** (`rules` grows to `[syntax, version, structure, ref, pathParam, operationId, security, tag, serverVar, unused]`):
    1. **ref:**
       - local and not found → error on the value: `Unresolved reference '<ref>'`;
       - pointing at another component kind than the slot expects (only when the target is `components/<known kind>`) → warning: `Expected a reference to components/<K>, but this points to components/<k>`;
       - external refs are ignored.
    2. **pathParam:**
       - `names` come from `{x}` in the path key;
       - `params(seq)` dereferences each item and reads `name`, `in` and `required`;
       - the reported position is the `name` value, or the item for a `$ref`;
       - this applies to the path-level list and to each operation's list (methods from `METHODS` plus the keys of `additionalOperations`);
       - an `in: path` parameter not in `names` → error: `Path parameter 'x' is not in the path '/a'`;
       - `required !== true` → error: `Path parameter 'x' must have required: true`;
       - duplicates within one list → error on each: `Duplicate parameter 'x' (in query)`;
       - after merging (`Map` keyed `in:name`, the operation overriding the path level), each name in `names` without `path:<name>` → error on the method key: `Path '{n}' has no 'in: path' parameter named 'n'`. A path with no operations is skipped.
    3. **operationId:** duplicates → error on each: `Duplicate operationId 'x'`. Covers webhooks and callbacks as well.
    4. **security:** a requirement key not in `components.securitySchemes` → error on the key: `Security scheme 'x' is not defined in components.securitySchemes`.
    5. **tag:** only when the root has `tags`. An operation tag not declared there → info: `Tag 'x' is used but not declared in tags`.
    6. **serverVar:** `{x}` in a server `url` without `variables.x` → error on the url value: `Server variable '{x}' is not defined in 'variables'`.
    7. **unused** (info):
       - `defined` holds every `components.<kind>.<name>`;
       - edges come from `sites` that point under `components`, counted at the `kind/name` level. The owner is the component holding the site, or `null` when the site is outside `components`;
       - `secUses` give edges to `securitySchemes/<name>` with a `null` owner;
       - each discriminator mapping value is `#/…` or a bare name, meaning `schemas/<name>`;
       - a BFS from the targets of `null`-owner edges follows the owners' edges;
       - anything unreached → info on its name key: `Component 'schemas/Item' is never referenced`. A cycle with no way in is flagged.
- **`src/editor.js`:**
  - imports `definitionAt` and `refHover`;
  - signature becomes `initEditor({ $, el, compareWith })`;
  - completion:
    - `insertTextRules: InsertAsSnippet` when `c.snippet`;
    - re-trigger suggest when `c.retrigger` or the insert ends in a newline plus indent;
    - add `/` to the trigger characters;
  - hover: try `refHover` first (escape every row with `md()`), then `fieldDoc`;
  - add `registerDefinitionProvider('yaml')`, which is a no-op for other models;
  - severity `info` maps to `MarkerSeverity.Info`;
  - the Problems badge counts errors and warnings only;
  - the `#ed-compare` button: `compareWith({original: saved != null && saved !== text ? saved : null, originalName: file ? file + ' (saved)' : 'Baseline', modified: text, modifiedName: file})`, then `setMode('compare')`.
- **`src/renderer.js`:** right before `initEditor`, add `const compareWith = ({original, originalName, modified, modifiedName}) => { if (original != null) load('left', original, originalName); load('right', modified, modifiedName); };` and pass it in.
- **`src/index.html`:** after `#ed-format`: `<button type="button" class="tbtn" id="ed-compare" title="Compare the version as opened or last saved with this text">Compare with…</button>`.
- **`package.json`:** version 1.9.0; then `npm run build`.
- **README "Edit mode":**
  - `$ref` completion, Ctrl+click / F12 to the definition, hover on a `$ref`;
  - the list of rules (info for unused components and undeclared tags);
  - the snippets;
  - Compare with…;
  - limits: external `$ref`s are ignored; there are no snippets in JSON.
- **ARCHITECTURE:**
  - add `refs.js`;
  - describe the rules list, the shared walk and the info severity;
  - describe how complete picks `$ref` targets and snippets, and `lookup`/`deref`;
  - add the Compare with… hook to Modes.

## Tests (`test/oas.test.js`)
- **`$ref` completion:**
  - each slot kind gives only its own components;
  - PathItem gets suggestions from 3.1, MediaType from 3.2;
  - quoting in YAML and JSON;
  - a prefix with a quote, and a bare name;
  - `/` is escaped as `~1`;
  - the `$ref` key is offered only where refs are allowed, only once, and with `retrigger`.
- **`definitionAt`:**
  - a value gives the key of the target;
  - outside the value → `null`;
  - external, `#` and unresolved → `null`;
  - the escaped `#/paths/~1a/get`;
  - a sequence item;
  - JSON.
- **`refHover`:** a schema, a parameter, a chain of refs, unresolved → `null`, and the range.
- **Rules:** one positive and one negative case per rule, with exact positions, covering:
  - the ref kind mismatch;
  - a path param resolved through `$ref`;
  - an operation overriding a path-level parameter;
  - unused: transitive use, a cycle, a scheme used only in `security`, a schema used only in a discriminator mapping.
- **Snippets:**
  - `expand()` strips the placeholders; `applyMonaco()` adds the cursor line's leading spaces to the continuation lines;
  - every snippet at indents 0, 2, 4 and 8, and after `- `, parses with no errors;
  - each snippet appears only in its own context: none under `properties`, none in JSON, and `operation` skips methods already present.
- **False positives:** no new errors on `examples/*.yaml` and fixtures; templates get zero markers. If an example truly breaks a rule, report it; do not weaken the rule silently.
- **Perf:** `validate` on the ~3k-line spec stays under 300 ms; `complete` for `$ref` there stays under 50 ms.

## Order
1. `pointer`, `refKind`, `METHODS`
2. `lookup` and `deref`
3. `refs.js` with its tests
4. `$ref` completion with its tests
5. Snippets with their tests
6. The rules with their tests
7. `index.html`, `editor.js`, `renderer.js`
8. Build, test and version
9. Docs
