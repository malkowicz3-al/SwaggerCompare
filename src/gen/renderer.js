(() => {
  // node_modules/yaml/browser/dist/nodes/identity.js
  var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
  var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
  var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
  var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
  var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
  var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
  var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

  // node_modules/yaml/browser/dist/visit.js
  var BREAK = /* @__PURE__ */ Symbol("break visit");
  var SKIP = /* @__PURE__ */ Symbol("skip children");
  var REMOVE = /* @__PURE__ */ Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i2 = 0; i2 < node.items.length; ++i2) {
          const ci = visit_(i2, node.items[i2], visitor, path);
          if (typeof ci === "number")
            i2 = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i2, 1);
            i2 -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = visit_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i2 = 0; i2 < node.items.length; ++i2) {
          const ci = await visitAsync_(i2, node.items[i2], visitor, path);
          if (typeof ci === "number")
            i2 = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i2, 1);
            i2 -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path) {
    if (typeof visitor === "function")
      return visitor(key, node, path);
    if (isMap(node))
      return visitor.Map?.(key, node, path);
    if (isSeq(node))
      return visitor.Seq?.(key, node, path);
    if (isPair(node))
      return visitor.Pair?.(key, node, path);
    if (isScalar(node))
      return visitor.Scalar?.(key, node, path);
    if (isAlias(node))
      return visitor.Alias?.(key, node, path);
    return void 0;
  }
  function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (isCollection(parent)) {
      parent.items[key] = node;
    } else if (isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }

  // node_modules/yaml/browser/dist/doc/directives.js
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
  var Directives = class _Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, _Directives.defaultTags, tags);
    }
    clone() {
      const copy = new _Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
      const res = new _Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: _Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, _Directives.defaultTags);
          break;
      }
      return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, _Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
        const tags = {};
        visit(doc.contents, (_key, node) => {
          if (isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join("\n");
    }
  };
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

  // node_modules/yaml/browser/dist/doc/anchors.js
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = /* @__PURE__ */ new Set();
    visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i2 = 1; true; ++i2) {
      const name = `${prefix}${i2}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = /* @__PURE__ */ new Map();
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      /**
       * With circular references, the source node is only resolved after all
       * of its child nodes are. This is why anchors are set only after all of
       * the nodes have been created.
       */
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }

  // node_modules/yaml/browser/dist/doc/applyReviver.js
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i2 = 0, len = val.length; i2 < len; ++i2) {
          const v0 = val[i2];
          const v1 = applyReviver(reviver, val, String(i2), v0);
          if (v1 === void 0)
            delete val[i2];
          else if (v1 !== v0)
            val[i2] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === void 0)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === void 0)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }

  // node_modules/yaml/browser/dist/nodes/toJS.js
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v2, i2) => toJS(v2, String(i2), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: void 0 };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }

  // node_modules/yaml/browser/dist/nodes/Node.js
  var NodeBase = class {
    constructor(type) {
      Object.defineProperty(this, NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
  };

  // node_modules/yaml/browser/dist/nodes/Alias.js
  var Alias = class extends NodeBase {
    constructor(source) {
      super(ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit(doc, {
          Node: (_key, node) => {
            if (isAlias(node) || hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = void 0;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      if (found && ctx) {
        const { anchors, doc: doc2, maxAliasCount } = ctx;
        let data = anchors.get(found);
        if (!data) {
          toJS(found, null, ctx);
          data = anchors.get(found);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc2, found, anchors);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const source = this.resolve(ctx.doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      return ctx.anchors.get(source).res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  };
  function getAliasCount(doc, node, anchors) {
    if (isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors && source && anchors.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (isCollection(node)) {
      let count = 0;
      for (const item2 of node.items) {
        const c = getAliasCount(doc, item2, anchors);
        if (c > count)
          count = c;
      }
      return count;
    } else if (isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors);
      const vc = getAliasCount(doc, node.value, anchors);
      return Math.max(kc, vc);
    }
    return 1;
  }

  // node_modules/yaml/browser/dist/nodes/Scalar.js
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
  var Scalar = class extends NodeBase {
    constructor(value) {
      super(SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  };
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

  // node_modules/yaml/browser/dist/doc/createNode.js
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (isDocument(value))
      value = value.contents;
    if (isNode(value))
      return value;
    if (isPair(value)) {
      const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
      map2.items.push(value);
      return map2;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
    let ref = void 0;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema4.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }

  // node_modules/yaml/browser/dist/nodes/Collection.js
  function collectionFromPath(schema4, path, value) {
    let v2 = value;
    for (let i2 = path.length - 1; i2 >= 0; --i2) {
      const k = path[i2];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a2 = [];
        a2[k] = v2;
        v2 = a2;
      } else {
        v2 = /* @__PURE__ */ new Map([[k, v2]]);
      }
    }
    return createNode(v2, void 0, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema: schema4,
      sourceObjects: /* @__PURE__ */ new Map()
    });
  }
  var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
  var Collection = class extends NodeBase {
    constructor(type, schema4) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema4,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema4) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema4)
        copy.schema = schema4;
      copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
      if (isEmptyPath(path))
        this.add(value);
      else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (isCollection(node))
          node.addIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && isScalar(node) ? node.value : node;
      else
        return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!isPair(node))
          return false;
        const n2 = node.value;
        return n2 == null || allowScalar && isScalar(n2) && n2.value == null && !n2.commentBefore && !n2.comment && !n2.tag;
      });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      const [key, ...rest] = path;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (isCollection(node))
          node.setIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyComment.js
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

  // node_modules/yaml/browser/dist/stringify/foldFlowLines.js
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = void 0;
    let prev = void 0;
    let overflow = false;
    let i2 = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i2 = consumeMoreIndentedLines(text, i2, indent.length);
      if (i2 !== -1)
        end = i2 + endStep;
    }
    for (let ch; ch = text[i2 += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i2;
        switch (text[i2 + 1]) {
          case "x":
            i2 += 3;
            break;
          case "u":
            i2 += 5;
            break;
          case "U":
            i2 += 9;
            break;
          default:
            i2 += 1;
        }
        escEnd = i2;
      }
      if (ch === "\n") {
        if (mode === FOLD_BLOCK)
          i2 = consumeMoreIndentedLines(text, i2, indent.length);
        end = i2 + indent.length + endStep;
        split = void 0;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
          const next = text[i2 + 1];
          if (next && next !== " " && next !== "\n" && next !== "	")
            split = i2;
        }
        if (i2 >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = void 0;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "	") {
              prev = ch;
              ch = text[i2 += 1];
              overflow = true;
            }
            const j = i2 > escEnd + 1 ? i2 - 2 : escStart - 1;
            if (escapedFolds[j])
              return text;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = void 0;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i3 = 0; i3 < folds.length; ++i3) {
      const fold = folds[i3];
      const end2 = folds[i3 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i2, indent) {
    let end = i2;
    let start = i2 + 1;
    let ch = text[start];
    while (ch === " " || ch === "	") {
      if (i2 < start + indent) {
        ch = text[++i2];
      } else {
        do {
          ch = text[++i2];
        } while (ch && ch !== "\n");
        end = i2;
        start = i2 + 1;
        ch = text[start];
      }
    }
    return end;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyString.js
  var getFoldOptions = (ctx, isBlock2) => ({
    indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i2 = 0, start = 0; i2 < strLen; ++i2) {
      if (str[i2] === "\n") {
        if (i2 - start > limit)
          return true;
        start = i2 + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i2 = 0, ch = json[i2]; ch; ch = json[++i2]) {
      if (ch === " " && json[i2 + 1] === "\\" && json[i2 + 2] === "n") {
        str += json.slice(start, i2) + "\\ ";
        i2 += 1;
        start = i2;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i2 + 1]) {
          case "u":
            {
              str += json.slice(start, i2);
              const code = json.substr(i2 + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i2, 6);
              }
              i2 += 5;
              start = i2 + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i2 + 2] === '"' || json.length < minMultiLineLength) {
              i2 += 1;
            } else {
              str += json.slice(start, i2) + "\n\n";
              while (json[i2 + 2] === "\\" && json[i2 + 3] === "n" && json[i2 + 4] !== '"') {
                str += "\n";
                i2 += 2;
              }
              str += indent;
              if (json[i2 + 2] === " ")
                str += "\\";
              i2 += 1;
              start = i2 + 1;
            }
            break;
          default:
            i2 += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? "|\n" : ">\n";
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== "\n" && ch !== "	" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf("\n");
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === "\n")
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === "\n")
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item2, ctx, onComment, onChompKeep) {
    const { type, value } = item2;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item2, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
      return blockString(item2, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item2, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item2, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item2.value === "string" ? item2 : Object.assign({}, item2, { value: String(item2.value) });
    let { type } = item2;
    if (type !== Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.BLOCK_FOLDED:
        case Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }

  // node_modules/yaml/browser/dist/stringify/stringify.js
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: /* @__PURE__ */ new Set(),
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item2) {
    if (item2.tag) {
      const match = tags.filter((t) => t.tag === item2.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item2.format) ?? match[0];
    }
    let tagObj = void 0;
    let obj;
    if (isScalar(item2)) {
      obj = item2.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item2.format) ?? match.find((t) => !t.format);
    } else {
      obj = item2;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
    if (anchor && anchorIsValid(anchor)) {
      anchors.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item2, ctx, onComment, onChompKeep) {
    if (isPair(item2))
      return item2.toString(ctx, onComment, onChompKeep);
    if (isAlias(item2)) {
      if (ctx.doc.directives)
        return item2.toString(ctx);
      if (ctx.resolvedAliases?.has(item2)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item2);
        else
          ctx.resolvedAliases = /* @__PURE__ */ new Set([item2]);
        item2 = item2.resolve(ctx.doc);
      }
    }
    let tagObj = void 0;
    const node = isNode(item2) ? item2 : ctx.doc.createNode(item2, { onTagObj: (o2) => tagObj = o2 });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }

  // node_modules/yaml/browser/dist/stringify/stringifyPair.js
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (isCollection(key) || !isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? "\n" : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === "\n" && valueComment)
          ws = "\n\n";
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf("\n");
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === "\n") {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }

  // node_modules/yaml/browser/dist/log.js
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      console.warn(warning);
    }
  }

  // node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map2, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map2, it);
    else
      mergeValue(ctx, map2, source);
  }
  function mergeValue(ctx, map2, value) {
    const source = resolveAliasValue(ctx, value);
    if (!isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map2 instanceof Map) {
        if (!map2.has(key))
          map2.set(key, value2);
      } else if (map2 instanceof Set) {
        map2.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
        Object.defineProperty(map2, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map2;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }

  // node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
  function addPairToJSMap(ctx, map2, { key, value }) {
    if (isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map2, value);
    else if (isMergeKey(ctx, key))
      addMergeToJSMap(ctx, map2, value);
    else {
      const jsKey = toJS(key, "", ctx);
      if (map2 instanceof Map) {
        map2.set(jsKey, toJS(value, jsKey, ctx));
      } else if (map2 instanceof Set) {
        map2.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS(value, stringKey, ctx);
        if (stringKey in map2)
          Object.defineProperty(map2, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map2[stringKey] = jsValue;
      }
    }
    return map2;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (isNode(key) && ctx?.doc) {
      const strCtx = createStringifyContext(ctx.doc, {});
      strCtx.anchors = /* @__PURE__ */ new Set();
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }

  // node_modules/yaml/browser/dist/nodes/Pair.js
  function createPair(key, value, ctx) {
    const k = createNode(key, void 0, ctx);
    const v2 = createNode(value, void 0, ctx);
    return new Pair(k, v2);
  }
  var Pair = class _Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, NODE_TYPE, { value: PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema4) {
      let { key, value } = this;
      if (isNode(key))
        key = key.clone(schema4);
      if (isNode(value))
        value = value.clone(schema4);
      return new _Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair2 = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      return addPairToJSMap(ctx, pair2, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyCollection.js
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify4(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i2 = 0; i2 < items.length; ++i2) {
      const item2 = items[i2];
      let comment2 = null;
      if (isNode(item2)) {
        if (!chompKeep && item2.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item2.commentBefore, chompKeep);
        if (item2.comment)
          comment2 = item2.comment;
      } else if (isPair(item2)) {
        const ik = isNode(item2.key) ? item2.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify(item2, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i2 = 1; i2 < lines.length; ++i2) {
        const line = lines[i2];
        str += line ? `
${indent}${line}` : "\n";
      }
    }
    if (comment) {
      str += "\n" + indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i2 = 0; i2 < items.length; ++i2) {
      const item2 = items[i2];
      let comment = null;
      if (isNode(item2)) {
        if (item2.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item2.commentBefore, false);
        if (item2.comment)
          comment = item2.comment;
      } else if (isPair(item2)) {
        const ik = isNode(item2.key) ? item2.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = isNode(item2.value) ? item2.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item2.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify(item2, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
      if (i2 < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : "\n";
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }

  // node_modules/yaml/browser/dist/nodes/YAMLMap.js
  function findPair(items, key) {
    const k = isScalar(key) ? key.value : key;
    for (const it of items) {
      if (isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return void 0;
  }
  var YAMLMap = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema4) {
      super(MAP, schema4);
      this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema4, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map2 = new this(schema4);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== void 0 || keepUndefined)
          map2.items.push(createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema4.sortMapEntries === "function") {
        map2.items.sort(schema4.sortMapEntries);
      }
      return map2;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair2, overwrite) {
      let _pair;
      if (isPair(pair2))
        _pair = pair2;
      else if (!pair2 || typeof pair2 !== "object" || !("key" in pair2)) {
        _pair = new Pair(pair2, pair2?.value);
      } else
        _pair = new Pair(pair2.key, pair2.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (isScalar(prev.value) && isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i2 = this.items.findIndex((item2) => sortEntries(_pair, item2) < 0);
        if (i2 === -1)
          this.items.push(_pair);
        else
          this.items.splice(i2, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
      const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const item2 of this.items)
        addPairToJSMap(ctx, map2, item2);
      return map2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item2 of this.items) {
        if (!isPair(item2))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item2)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  };

  // node_modules/yaml/browser/dist/schema/common/map.js
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/nodes/YAMLSeq.js
  var YAMLSeq = class extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema4) {
      super(SEQ, schema4);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return void 0;
      const it = this.items[idx];
      return !keepScalar && isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (isScalar(prev) && isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq2 = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq2);
      let i2 = 0;
      for (const item2 of this.items)
        seq2.push(toJS(item2, String(i2++), ctx));
      return seq2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema4, obj, ctx) {
      const { replacer } = ctx;
      const seq2 = new this(schema4);
      if (obj && Symbol.iterator in Object(obj)) {
        let i2 = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i2++);
            it = replacer.call(obj, key, it);
          }
          seq2.items.push(createNode(it, void 0, ctx));
        }
      }
      return seq2;
    }
  };
  function asItemIndex(key) {
    let idx = isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  // node_modules/yaml/browser/dist/schema/common/seq.js
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
  };

  // node_modules/yaml/browser/dist/schema/common/string.js
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item2, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString(item2, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/common/null.js
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };

  // node_modules/yaml/browser/dist/schema/core/bool.js
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyNumber.js
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n2 = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n2) && !n2.includes("e")) {
      let i2 = n2.indexOf(".");
      if (i2 < 0) {
        i2 = n2.length;
        n2 += ".";
      }
      let d = minFractionDigits - (n2.length - i2 - 1);
      while (d-- > 0)
        n2 += "0";
    }
    return n2;
  }

  // node_modules/yaml/browser/dist/schema/core/float.js
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/core/int.js
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/core/schema.js
  var schema = [
    map,
    seq,
    string,
    nullTag,
    boolTag,
    intOct,
    int,
    intHex,
    floatNaN,
    floatExp,
    float
  ];

  // node_modules/yaml/browser/dist/schema/json/schema.js
  function intIdentify2(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify2,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema2 = [map, seq].concat(jsonScalars, jsonError);

  // node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: "tag:yaml.org,2002:binary",
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
      if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i2 = 0; i2 < str.length; ++i2)
          buffer[i2] = str.charCodeAt(i2);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof btoa === "function") {
        let s2 = "";
        for (let i2 = 0; i2 < buf.length; ++i2)
          s2 += String.fromCharCode(buf[i2]);
        str = btoa(s2);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.BLOCK_LITERAL);
      if (type !== Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n2 = Math.ceil(str.length / lineWidth);
        const lines = new Array(n2);
        for (let i2 = 0, o2 = 0; i2 < n2; ++i2, o2 += lineWidth) {
          lines[i2] = str.substr(o2, lineWidth);
        }
        str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
      }
      return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
  function resolvePairs(seq2, onError) {
    if (isSeq(seq2)) {
      for (let i2 = 0; i2 < seq2.items.length; ++i2) {
        let item2 = seq2.items[i2];
        if (isPair(item2))
          continue;
        else if (isMap(item2)) {
          if (item2.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair2 = item2.items[0] || new Pair(new Scalar(null));
          if (item2.commentBefore)
            pair2.key.commentBefore = pair2.key.commentBefore ? `${item2.commentBefore}
${pair2.key.commentBefore}` : item2.commentBefore;
          if (item2.comment) {
            const cn = pair2.value ?? pair2.key;
            cn.comment = cn.comment ? `${item2.comment}
${cn.comment}` : item2.comment;
          }
          item2 = pair2;
        }
        seq2.items[i2] = isPair(item2) ? item2 : new Pair(item2);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq2;
  }
  function createPairs(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq(schema4);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i2 = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i2++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
  var YAMLOMap = class _YAMLOMap extends YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.prototype.set.bind(this);
      this.tag = _YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map2 = /* @__PURE__ */ new Map();
      if (ctx?.onCreate)
        ctx.onCreate(map2);
      for (const pair2 of this.items) {
        let key, value;
        if (isPair(pair2)) {
          key = toJS(pair2.key, "", ctx);
          value = toJS(pair2.value, key, ctx);
        } else {
          key = toJS(pair2, "", ctx);
        }
        if (map2.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map2.set(key, value);
      }
      return map2;
    }
    static from(schema4, iterable, ctx) {
      const pairs2 = createPairs(schema4, iterable, ctx);
      const omap2 = new this();
      omap2.items = pairs2.items;
      return omap2;
    }
  };
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq2, onError) {
      const pairs2 = resolvePairs(seq2, onError);
      const seenKeys = [];
      for (const { key } of pairs2.items) {
        if (isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap(), pairs2);
    },
    createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar(false),
    stringify: boolStringify
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
  var floatNaN2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  var floatExp2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  var float2 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
  var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve2(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n3 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n3 : n3;
    }
    const n2 = parseInt(str, radix);
    return sign === "-" ? -1 * n2 : n2;
  }
  function intStringify2(node, radix, prefix) {
    const { value } = node;
    if (intIdentify3(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
    stringify: (node) => intStringify2(node, 2, "0b")
  };
  var intOct2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
    stringify: (node) => intStringify2(node, 8, "0")
  };
  var int2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  var intHex2 = {
    identify: intIdentify3,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
    stringify: (node) => intStringify2(node, 16, "0x")
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
  var YAMLSet = class _YAMLSet extends YAMLMap {
    constructor(schema4) {
      super(schema4);
      this.tag = _YAMLSet.tag;
    }
    add(key) {
      let pair2;
      if (isPair(key))
        pair2 = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair2 = new Pair(key.key, null);
      else
        pair2 = new Pair(key, null);
      const prev = findPair(this.items, pair2.key);
      if (!prev)
        this.items.push(pair2);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
      const pair2 = findPair(this.items, key);
      return !keepPair && isPair(pair2) ? isScalar(pair2.key) ? pair2.key.value : pair2.key : pair2;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema4, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema4);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(createPair(value, null, ctx));
        }
      return set2;
    }
  };
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
    resolve(map2, onError) {
      if (isMap(map2)) {
        if (map2.hasAllNullValues(true))
          return Object.assign(new YAMLSet(), map2);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map2;
    }
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n2) => asBigInt ? BigInt(n2) : Number(n2);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n2) => n2;
    if (typeof value === "bigint")
      num = (n2) => BigInt(n2);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n2) => String(n2).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 6e4 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };

  // node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
  var schema3 = [
    map,
    seq,
    string,
    nullTag,
    trueTag,
    falseTag,
    intBin,
    intOct2,
    int2,
    intHex2,
    floatNaN2,
    floatExp2,
    float2,
    binary,
    merge,
    omap,
    pairs,
    set,
    intTime,
    floatTime,
    timestamp
  ];

  // node_modules/yaml/browser/dist/schema/tags.js
  var schemas = /* @__PURE__ */ new Map([
    ["core", schema],
    ["failsafe", [map, seq, string]],
    ["json", schema2],
    ["yaml11", schema3],
    ["yaml-1.1", schema3]
  ]);
  var tagsByName = {
    binary,
    bool: boolTag,
    float,
    floatExp,
    floatNaN,
    floatTime,
    int,
    intHex,
    intOct,
    intTime,
    map,
    merge,
    null: nullTag,
    omap,
    pairs,
    seq,
    set,
    timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary,
    "tag:yaml.org,2002:merge": merge,
    "tag:yaml.org,2002:omap": omap,
    "tag:yaml.org,2002:pairs": pairs,
    "tag:yaml.org,2002:set": set,
    "tag:yaml.org,2002:timestamp": timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }

  // node_modules/yaml/browser/dist/schema/Schema.js
  var sortMapEntriesByKey = (a2, b2) => a2.key < b2.key ? -1 : a2.key > b2.key ? 1 : 0;
  var Schema = class _Schema {
    constructor({ compat, customTags, merge: merge3, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
      this.name = typeof schema4 === "string" && schema4 || "core";
      this.knownTags = resolveKnownTags ? coreKnownTags : {};
      this.tags = getTags(customTags, this.name, merge3);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, MAP, { value: map });
      Object.defineProperty(this, SCALAR, { value: string });
      Object.defineProperty(this, SEQ, { value: seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  };

  // node_modules/yaml/browser/dist/stringify/stringifyDocument.js
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
      let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes("\n")) {
          lines.push("...");
          lines.push(indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(indentComment(commentString(dc), ""));
      }
    }
    return lines.join("\n") + "\n";
  }

  // node_modules/yaml/browser/dist/doc/Document.js
  var Document = class _Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, NODE_TYPE, { value: DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new Directives({ version });
      this.setSchema(version, options);
      this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
      const copy = Object.create(_Document.prototype, {
        [NODE_TYPE]: { value: DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** Adds a value to the document. */
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchorNames(this);
        node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
      }
      return new Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = void 0;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v2) => typeof v2 === "number" || v2 instanceof String || v2 instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
        this,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || "a"
      );
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode(value, tag, ctx);
      if (flow && isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v2 = this.createNode(value, null, options);
      return new Pair(k, v2);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      if (isEmptyPath(path)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
      return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      if (isEmptyPath(path))
        return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
      return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
      return isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
      if (isEmptyPath(path))
        return this.contents !== void 0;
      return isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
      if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      if (isEmptyPath(path)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, Array.from(path), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path, value);
      }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s2 = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s2}`);
      }
      return stringifyDocument(this, options);
    }
  };
  function assertCollection(contents) {
    if (isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }

  // node_modules/yaml/browser/dist/errors.js
  var YAMLError = class extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  };
  var YAMLParseError = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  };
  var YAMLWarning = class extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  };
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "\u2026" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "\u2026";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + "\u2026\n";
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer2 = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer2}
`;
    }
  };

  // node_modules/yaml/browser/dist/compose/resolve-props.js
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        // else fallthrough
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }

  // node_modules/yaml/browser/dist/compose/util-contains-newline.js
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes("\n"))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }

  // node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }

  // node_modules/yaml/browser/dist/compose/util-map-includes.js
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a2, b2) => a2 === b2 || isScalar(a2) && isScalar(b2) && a2.value === b2.value;
    return items.some((pair2) => isEqual(pair2.key, search));
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-map.js
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap;
    const map2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map2.comment)
              map2.comment += "\n" + keyProps.comment;
            else
              map2.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (mapIncludes(ctx, map2.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair2 = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair2.srcToken = collItem;
        map2.items.push(pair2);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair2 = new Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair2.srcToken = collItem;
        map2.items.push(pair2);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map2.range = [bm.offset, offset, commentEnd ?? offset];
    return map2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-seq.js
  function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq;
    const seq2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq2.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq2.items.push(node);
    }
    seq2.range = [bs.offset, offset, commentEnd ?? offset];
    return seq2;
  }

  // node_modules/yaml/browser/dist/compose/resolve-end.js
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
    const isMap2 = fc.start.source === "{";
    const fcName = isMap2 ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i2 = 0; i2 < fc.items.length; ++i2) {
      const collItem = fc.items[i2];
      const { start, key, sep, value } = collItem;
      const props = resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i2 === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i2 < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += "\n" + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap2 && ctx.options.strict && containsNewline(key))
          onError(
            key,
            // checked by containsNewline()
            "MULTILINE_IMPLICIT_KEY",
            "Implicit keys of flow sequence pairs need to be on a single line"
          );
      }
      if (i2 === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop: for (const st of start) {
            switch (st.type) {
              case "comma":
              case "space":
                break;
              case "comment":
                prevItemComment = st.source.substring(1);
                break loop;
              default:
                break loop;
            }
          }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += "\n" + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap2 && !sep && !props.found) {
        const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap2 && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair2 = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair2.srcToken = collItem;
        if (isMap2) {
          const map2 = coll;
          if (mapIncludes(ctx, map2.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map2.items.push(pair2);
        } else {
          const map2 = new YAMLMap(ctx.schema);
          map2.flow = true;
          map2.items.push(pair2);
          const endRange = (valueNode ?? keyNode).range;
          map2.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map2);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap2 ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += "\n" + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }

  // node_modules/yaml/browser/dist/compose/compose-collection.js
  function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN2, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN2, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = isNode(res) ? res : new Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }

  // node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
  function resolveBlockScalar(ctx, scalar2, onError) {
    const start = scalar2.offset;
    const header = parseBlockScalarHeader(scalar2, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
    const lines = scalar2.source ? splitLines(scalar2.source) : [];
    let chompStart = lines.length;
    for (let i2 = lines.length - 1; i2 >= 0; --i2) {
      const content2 = lines[i2][1];
      if (content2 === "" || content2 === "\r")
        chompStart = i2;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar2.source)
        end2 += scalar2.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar2.indent + header.indent;
    let offset = scalar2.offset + header.length;
    let contentStart = 0;
    for (let i2 = 0; i2 < chompStart; ++i2) {
      const [indent, content2] = lines[i2];
      if (content2 === "" || content2 === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i2;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content2.length + 1;
    }
    for (let i2 = lines.length - 1; i2 >= chompStart; --i2) {
      if (lines[i2][0].length > trimIndent)
        chompStart = i2 + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i2 = 0; i2 < contentStart; ++i2)
      value += lines[i2][0].slice(trimIndent) + "\n";
    for (let i2 = contentStart; i2 < chompStart; ++i2) {
      let [indent, content2] = lines[i2];
      offset += indent.length + content2.length + 1;
      const crlf = content2[content2.length - 1] === "\r";
      if (crlf)
        content2 = content2.slice(0, -1);
      if (content2 && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content2.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content2;
        sep = "\n";
      } else if (indent.length > trimIndent || content2[0] === "	") {
        if (sep === " ")
          sep = "\n";
        else if (!prevMoreIndented && sep === "\n")
          sep = "\n\n";
        value += sep + indent.slice(trimIndent) + content2;
        sep = "\n";
        prevMoreIndented = true;
      } else if (content2 === "") {
        if (sep === "\n")
          value += "\n";
        else
          sep = "\n";
      } else {
        value += sep + content2;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i2 = chompStart; i2 < lines.length; ++i2)
          value += "\n" + lines[i2][0].slice(trimIndent);
        if (value[value.length - 1] !== "\n")
          value += "\n";
        break;
      default:
        value += "\n";
    }
    const end = start + header.length + scalar2.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i2 = 1; i2 < source.length; ++i2) {
      const ch = source[i2];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n2 = Number(ch);
        if (!indent && n2)
          indent = n2;
        else if (error === -1)
          error = offset + i2;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i2 = 1; i2 < props.length; ++i2) {
      const token = props[i2];
      switch (token.type) {
        case "space":
          hasSpace = true;
        // fallthrough
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        /* istanbul ignore next should not happen */
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m2 = first.match(/^( *)/);
    const line0 = m2?.[1] ? [m2[1], first.slice(m2[1].length)] : ["", first];
    const lines = [line0];
    for (let i2 = 1; i2 < split.length; i2 += 2)
      lines.push([split[i2], split[i2 + 1]]);
    return lines;
  }

  // node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
  function resolveFlowScalar(scalar2, strict, onError) {
    const { offset, type, source, end } = scalar2;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      /* istanbul ignore next should not happen */
      default:
        onError(scalar2, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      /* istanbul ignore next should not happen */
      case "	":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return unfoldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function unfoldLines(source) {
    const line = /(.*?)\r?\n/sy;
    let match = line.exec(source);
    if (!match)
      return source;
    let trimEnd, trimBoth;
    try {
      trimEnd = new RegExp("(?<![ 	])[ 	]+$");
      trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
    } catch {
      trimEnd = /[ \t]+$/;
      trimBoth = /^[ \t]+|[ \t]+$/g;
    }
    let res = match[1].replace(trimEnd, "");
    let sep = " ";
    let pos = line.lastIndex;
    while (match = line.exec(source)) {
      const lm = match[1].replace(trimBoth, "");
      if (lm === "") {
        if (sep === "\n")
          res += sep;
        else
          sep = "\n";
      } else {
        res += sep + lm;
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i2 = 1; i2 < source.length - 1; ++i2) {
      const ch = source[i2];
      if (ch === "\r" && source[i2 + 1] === "\n")
        continue;
      if (ch === "\n") {
        const { fold, offset } = foldNewline(source, i2);
        res += fold;
        i2 = offset;
      } else if (ch === "\\") {
        let next = source[++i2];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === "\n") {
          next = source[i2 + 1];
          while (next === " " || next === "	")
            next = source[++i2 + 1];
        } else if (next === "\r" && source[i2 + 1] === "\n") {
          next = source[++i2 + 1];
          while (next === " " || next === "	")
            next = source[++i2 + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i2 + 1, length, onError);
          i2 += length;
        } else {
          const raw = source.substr(i2 - 1, 2);
          onError(i2 - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "	") {
        const wsStart = i2;
        let next = source[i2 + 1];
        while (next === " " || next === "	")
          next = source[++i2 + 1];
        if (next !== "\n" && !(next === "\r" && source[i2 + 2] === "\n"))
          res += i2 > wsStart ? source.slice(wsStart, i2 + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== "\n")
        break;
      if (ch === "\n")
        fold += "\n";
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\0",
    // null character
    a: "\x07",
    // bell character
    b: "\b",
    // backspace
    e: "\x1B",
    // escape character
    f: "\f",
    // form feed
    n: "\n",
    // line feed
    r: "\r",
    // carriage return
    t: "	",
    // horizontal tab
    v: "\v",
    // vertical tab
    N: "\x85",
    // Unicode next line
    _: "\xA0",
    // Unicode non-breaking space
    L: "\u2028",
    // Unicode line separator
    P: "\u2029",
    // Unicode paragraph separator
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "	": "	"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }

  // node_modules/yaml/browser/dist/compose/compose-scalar.js
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range: range2 } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[SCALAR];
    let scalar2;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar2 = isScalar(res) ? res : new Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar2 = new Scalar(value);
    }
    scalar2.range = range2;
    scalar2.source = value;
    if (type)
      scalar2.type = type;
    if (tagName)
      scalar2.tag = tagName;
    if (tag.format)
      scalar2.format = tag.format;
    if (comment)
      scalar2.comment = comment;
    return scalar2;
  }
  function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema4[SCALAR];
    const matchWithTest = [];
    for (const tag of schema4.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema4.knownTags[tagName];
    if (kt && !kt.collection) {
      schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema4[SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
    const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
    if (schema4.compat) {
      const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }

  // node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i2 = pos - 1; i2 >= 0; --i2) {
        let st = before[i2];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i2];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i2];
        }
        break;
      }
    }
    return offset;
  }

  // node_modules/yaml/browser/dist/compose/compose-node.js
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }

  // node_modules/yaml/browser/dist/compose/compose-doc.js
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document(void 0, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }

  // node_modules/yaml/browser/dist/compose/composer.js
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i2 = 0; i2 < prelude.length; ++i2) {
      const source = prelude[i2];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i2 + 1]?.[0] !== "#")
            i2 += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }
  var Composer = class {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new YAMLWarning(pos, code, message));
        else
          this.errors.push(new YAMLParseError(pos, code, message));
      };
      this.directives = new Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i2 = 0; i2 < this.errors.length; ++i2)
          doc.errors.push(this.errors[i2]);
        for (let i2 = 0; i2 < this.warnings.length; ++i2)
          doc.warnings.push(this.warnings[i2]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document(void 0, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  };

  // node_modules/yaml/browser/dist/parse/cst-visit.js
  var BREAK2 = /* @__PURE__ */ Symbol("break visit");
  var SKIP2 = /* @__PURE__ */ Symbol("skip children");
  var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
  function visit2(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit2.BREAK = BREAK2;
  visit2.SKIP = SKIP2;
  visit2.REMOVE = REMOVE2;
  visit2.itemAtPath = (cst, path) => {
    let item2 = cst;
    for (const [field, index] of path) {
      const tok = item2?.[field];
      if (tok && "items" in tok) {
        item2 = tok.items[index];
      } else
        return void 0;
    }
    return item2;
  };
  visit2.parentCollection = (cst, path) => {
    const parent = visit2.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path, item2, visitor) {
    let ctrl = visitor(item2, path);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item2[field];
      if (token && "items" in token) {
        for (let i2 = 0; i2 < token.items.length; ++i2) {
          const ci = _visit(Object.freeze(path.concat([[field, i2]])), token.items[i2], visitor);
          if (typeof ci === "number")
            i2 = ci - 1;
          else if (ci === BREAK2)
            return BREAK2;
          else if (ci === REMOVE2) {
            token.items.splice(i2, 1);
            i2 -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item2, path);
      }
    }
    return typeof ctrl === "function" ? ctrl(item2, path) : ctrl;
  }

  // node_modules/yaml/browser/dist/parse/cst.js
  var BOM = "\uFEFF";
  var DOCUMENT = "";
  var FLOW_END = "";
  var SCALAR2 = "";
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR2:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case "\n":
      case "\r\n":
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "	":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }

  // node_modules/yaml/browser/dist/parse/lexer.js
  function isEmpty(ch) {
    switch (ch) {
      case void 0:
      case " ":
      case "\n":
      case "\r":
      case "	":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(" ,[]{}\n\r	");
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
  var Lexer = class {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i2 = this.pos;
      let ch = this.buffer[i2];
      while (ch === " " || ch === "	")
        ch = this.buffer[++i2];
      if (!ch || ch === "#" || ch === "\n")
        return true;
      if (ch === "\r")
        return this.buffer[i2 + 1] === "\n";
      return false;
    }
    charAt(n2) {
      return this.buffer[this.pos + n2];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === "\n" || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf("\n", this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n2) {
      return this.pos + n2 <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n2) {
      return this.buffer.substr(this.pos, n2);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "	") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "	")
            dirEnd -= 1;
          else
            break;
        }
        const n2 = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n2);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s2 = this.peek(3);
        if ((s2 === "---" || s2 === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s2 === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n2 = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n2;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n2 = yield* this.pushIndicators();
      switch (line[n2]) {
        case "#":
          yield* this.pushCount(line.length - n2);
        // fallthrough
        case void 0:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n2 += yield* this.parseBlockScalarHeader();
          n2 += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n2);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n2 = 0;
      while (line[n2] === ",") {
        n2 += yield* this.pushCount(1);
        n2 += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n2 += yield* this.pushIndicators();
      switch (line[n2]) {
        case void 0:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n2);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        // fallthrough
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n2 = 0;
          while (this.buffer[end - 1 - n2] === "\\")
            n2 += 1;
          if (n2 % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf("\n", this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf("\n", cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i2 = this.pos;
      while (true) {
        const ch = this.buffer[++i2];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop: for (let i3 = this.pos; ch = this.buffer[i3]; ++i3) {
        switch (ch) {
          case " ":
            indent += 1;
            break;
          case "\n":
            nl = i3;
            indent = 0;
            break;
          case "\r": {
            const next = this.buffer[i3 + 1];
            if (!next && !this.atEnd)
              return this.setNext("block-scalar");
            if (next === "\n")
              break;
          }
          // fallthrough
          default:
            break loop;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf("\n", cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i2 = nl + 1;
      ch = this.buffer[i2];
      while (ch === " ")
        ch = this.buffer[++i2];
      if (ch === "	") {
        while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
          ch = this.buffer[++i2];
        nl = i2 - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i3 = nl - 1;
          let ch2 = this.buffer[i3];
          if (ch2 === "\r")
            ch2 = this.buffer[--i3];
          const lastChar = i3;
          while (ch2 === " ")
            ch2 = this.buffer[--i3];
          if (ch2 === "\n" && i3 >= this.pos && i3 + 1 + indent > lastChar)
            nl = i3;
          else
            break;
        } while (true);
      }
      yield SCALAR2;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i2 = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i2]) {
        if (ch === ":") {
          const next = this.buffer[i2 + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i2;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i2 + 1];
          if (ch === "\r") {
            if (next === "\n") {
              i2 += 1;
              ch = "\n";
              next = this.buffer[i2 + 1];
            } else
              end = i2;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === "\n") {
            const cs = this.continueScalar(i2 + 1);
            if (cs === -1)
              break;
            i2 = Math.max(i2, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i2;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield SCALAR2;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n2) {
      if (n2 > 0) {
        yield this.buffer.substr(this.pos, n2);
        this.pos += n2;
        return n2;
      }
      return 0;
    }
    *pushToIndex(i2, allowEmpty) {
      const s2 = this.buffer.slice(this.pos, i2);
      if (s2) {
        yield s2;
        this.pos += s2.length;
        return s2.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n2 = 0;
      loop: while (true) {
        switch (this.charAt(0)) {
          case "!":
            n2 += yield* this.pushTag();
            n2 += yield* this.pushSpaces(true);
            continue loop;
          case "&":
            n2 += yield* this.pushUntil(isNotAnchorChar);
            n2 += yield* this.pushSpaces(true);
            continue loop;
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              n2 += yield* this.pushCount(1);
              n2 += yield* this.pushSpaces(true);
              continue loop;
            }
          }
        }
        break loop;
      }
      return n2;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i2 = this.pos + 2;
        let ch = this.buffer[i2];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i2];
        return yield* this.pushToIndex(ch === ">" ? i2 + 1 : i2, false);
      } else {
        let i2 = this.pos + 1;
        let ch = this.buffer[i2];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i2];
          else if (ch === "%" && hexDigits.has(this.buffer[i2 + 1]) && hexDigits.has(this.buffer[i2 + 2])) {
            ch = this.buffer[i2 += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i2, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === "\n")
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === "\n")
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i2 = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i2];
      } while (ch === " " || allowTabs && ch === "	");
      const n2 = i2 - this.pos;
      if (n2 > 0) {
        yield this.buffer.substr(this.pos, n2);
        this.pos = i2;
      }
      return n2;
    }
    *pushUntil(test) {
      let i2 = this.pos;
      let ch = this.buffer[i2];
      while (!test(ch))
        ch = this.buffer[++i2];
      return yield* this.pushToIndex(i2, false);
    }
  };

  // node_modules/yaml/browser/dist/parse/line-counter.js
  var LineCounter = class {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  };

  // node_modules/yaml/browser/dist/parse/parser.js
  function includesToken(list, type) {
    for (let i2 = 0; i2 < list.length; ++i2)
      if (list[i2].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i2 = 0; i2 < list.length; ++i2) {
      switch (list[i2].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i2;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      /* istanbul ignore next should not happen */
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i2 = prev.length;
    loop: while (--i2 >= 0) {
      switch (prev[i2].type) {
        case "doc-start":
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
        case "newline":
          break loop;
      }
    }
    while (prev[++i2]?.type === "space") {
    }
    return prev.splice(i2, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i2 = 0; i2 < source.length; ++i2)
        target.push(source[i2]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }
  var Parser = class {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new Lexer();
      this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
      this.source = source;
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n2) {
      return this.stack[this.stack.length - n2];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar2) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar2.end) {
          sep = scalar2.end;
          sep.push(this.sourceToken);
          delete scalar2.end;
        } else
          sep = [this.sourceToken];
        const map2 = {
          type: "block-map",
          offset: scalar2.offset,
          indent: scalar2.indent,
          items: [{ start, key: scalar2, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else
        yield* this.lineEnd(scalar2);
    }
    *blockScalar(scalar2) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar2.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar2.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf("\n") + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf("\n", nl) + 1;
            }
          }
          yield* this.pop();
          break;
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map2) {
      const it = map2.items[map2.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map2.indent)) {
              const prev = map2.items[map2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map2.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i2 = 0; i2 < it.sep.length; ++i2) {
            const st = it.sep[i2];
            switch (st.type) {
              case "newline":
                nl.push(i2);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map2.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map2.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map2.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map2);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map2.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq2) {
      const it = seq2.items[seq2.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : void 0;
            const last = Array.isArray(end) ? end[end.length - 1] : void 0;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq2.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq2.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq2.indent)) {
              const prev = seq2.items[seq2.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq2.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq2.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq2.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq2.indent) {
        const bv = this.startBlockValue(seq2);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map2 = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map2;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf("\n") + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf("\n", nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        // fallthrough
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  };

  // node_modules/yaml/browser/dist/public-api.js
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
    return { lineCounter, prettyErrors };
  }
  function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser = new Parser(lineCounter?.addNewLine);
    const composer = new Composer(options);
    let doc = null;
    for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter) {
      doc.errors.forEach(prettifyError(source, lineCounter));
      doc.warnings.forEach(prettifyError(source, lineCounter));
    }
    return doc;
  }

  // src/compare.js
  var METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
  function compare(leftText, rightText) {
    const L = parse2(leftText, "left");
    const R = parse2(rightText, "right");
    const meta = { left: L.error ? null : metaOf(L.data), right: R.error ? null : metaOf(R.data) };
    if (L.error) return { ...L, meta };
    if (R.error) return { ...R, meta };
    const changes = [];
    const st = { changes, left: L.index, right: R.index, lData: L.data, rData: R.data, useL: usage(L.data), useR: usage(R.data), affects: /* @__PURE__ */ new Map(), extracted: /* @__PURE__ */ new Set(), inlined: /* @__PURE__ */ new Set() };
    walk(L.data, R.data, { path: [], pl: [], pr: [], st });
    const covered = (c) => (c.kind === "added" ? st.extracted : c.kind === "removed" ? st.inlined : /* @__PURE__ */ new Set()).has(JSON.stringify(c.path));
    return { changes: changes.filter((c) => !covered(c)), meta };
  }
  var scalar = (v2) => typeof v2 === "string" || typeof v2 === "number" ? String(v2) : void 0;
  var metaOf = (d) => ({ title: scalar(d?.info?.title), version: scalar(d?.info?.version), spec: scalar(d?.openapi ?? d?.swagger) });
  function parse2(text, side) {
    const lc = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lc });
    const fail = (line, message) => ({ error: { side, line, message } });
    if (doc.errors.length) {
      const e = doc.errors[0];
      return fail(e.linePos?.[0].line ?? 1, e.message.split("\n")[0]);
    }
    if (doc.contents == null) return fail(1, "Empty document");
    if (!isMap(doc.contents)) return fail(1, "Document root must be a mapping");
    try {
      return { data: doc.toJS(), index: buildIndex(doc, lc, text) };
    } catch (e) {
      return fail(1, e.message.split("\n")[0]);
    }
  }
  function buildIndex(doc, lc, text) {
    const index = /* @__PURE__ */ new Map([[JSON.stringify([]), { start: 1, end: 1 }]]);
    const span = (from, to, min) => {
      let off = Math.max(to - 1, min - 1);
      while (off > from && /\s/.test(text[off])) off--;
      return { start: lc.linePos(from).line, end: lc.linePos(off).line };
    };
    const keyAt = ([s2, e]) => {
      const { line, col } = lc.linePos(s2);
      return { line, from: col, to: col + e - s2 };
    };
    const visit3 = (node, path) => {
      if (isMap(node)) {
        for (const p of node.items) {
          if (!isScalar(p.key)) continue;
          const sub = [...path, String(p.key.value)];
          index.set(JSON.stringify(sub), { ...span(p.key.range[0], p.value?.range?.[1] ?? p.key.range[1], p.key.range[1]), key: keyAt(p.key.range) });
          visit3(p.value, sub);
        }
      } else if (isSeq(node)) {
        node.items.forEach((item2, i2) => {
          const sub = [...path, i2];
          const name = isMap(item2) ? item2.items.find((q) => isScalar(q.key) && q.key.value === "name")?.value : item2;
          if (item2?.range) index.set(JSON.stringify(sub), { ...span(item2.range[0], item2.range[1], item2.range[1]), ...isScalar(name) && { key: keyAt(name.range) } });
          visit3(item2, sub);
        });
      }
    };
    visit3(doc.contents, []);
    return index;
  }
  function nearest(index, path) {
    for (let i2 = path.length; i2 >= 0; i2--) {
      const r = index.get(JSON.stringify(path.slice(0, i2)));
      if (r) return { r, exact: i2 === path.length };
    }
    return { r: { start: 1, end: 1 }, exact: false };
  }
  var lineOf = (index, path) => nearest(index, path).r.start;
  function rangeOf(index, path) {
    const { r, exact } = nearest(index, path);
    return exact ? { start: r.start, end: r.end, exact } : { start: r.start, end: r.start, exact };
  }
  var isPlain = (v2) => v2 !== null && typeof v2 === "object" && !Array.isArray(v2);
  var has = (o2, k) => Object.hasOwn(o2, k);
  var get = (o2, k) => has(o2, k) ? o2[k] : void 0;
  function eq(a2, b2) {
    if (a2 === b2) return true;
    if (Array.isArray(a2) && Array.isArray(b2)) return a2.length === b2.length && a2.every((v2, i2) => eq(v2, b2[i2]));
    if (isPlain(a2) && isPlain(b2)) {
      const ka = Object.keys(a2);
      return ka.length === Object.keys(b2).length && ka.every((k) => has(b2, k) && eq(a2[k], b2[k]));
    }
    return false;
  }
  var fmt = (v2) => isPlain(v2) ? "{\u2026}" : Array.isArray(v2) ? "[\u2026]" : JSON.stringify(v2);
  function child(ctx, k, { l: l2 = k, r = k, shown = k } = {}) {
    return { ...ctx, path: [...ctx.path, shown], pl: [...ctx.pl, l2], pr: [...ctx.pr, r] };
  }
  var SINGULAR = {
    definitions: "schema",
    schemas: "schema",
    parameters: "parameter",
    responses: "response",
    requestBodies: "request body",
    headers: "header",
    securitySchemes: "security scheme",
    securityDefinitions: "security definition",
    examples: "example",
    links: "link",
    callbacks: "callback"
  };
  function nameAt(P) {
    if (P[0] === "components" && P.length > 2) return 2;
    return ["definitions", "parameters", "responses", "securityDefinitions"].includes(P[0]) && P.length > 1 ? 1 : -1;
  }
  function compLabel(segs) {
    const i2 = nameAt(segs);
    return i2 > 0 && segs.length === i2 + 1 ? `${SINGULAR[segs[i2 - 1]] ?? segs[i2 - 1]} ${segs[i2]}` : void 0;
  }
  var noProps = (segs) => segs.filter((s2, i2) => s2 !== "properties" || i2 === segs.length - 1);
  function pretty(R) {
    if (R[0] === "requestBody") {
      if (R[1] !== "content" || R.length < 3) return ["request body", ...R.slice(1)];
      return R[3] === "schema" ? ["request body", ...R.slice(4)] : [`request body (${R[2]})`, ...R.slice(3)];
    }
    if (R[0] === "responses" && R.length > 1) {
      const n2 = R[2] === "content" && R.length > 4 && R[4] === "schema" ? 5 : R[2] === "schema" ? 3 : 2;
      return [`response ${R[1]}`, ...R.slice(n2)];
    }
    const m2 = R[0] === "parameters" && /^[^:/#]+:(.*)$/.exec(R[1] ?? "");
    if (m2) return [m2[1], ...R.slice(R[2] === "schema" ? 3 : 2)];
    return R;
  }
  function locate(ctx, asObject = false) {
    const P = ctx.path.map(String);
    if (ctx.st.detail) return { where: "", rest: pretty(noProps(P)) };
    if (P[0] === "paths") {
      if (P.length < 3) return { where: "paths", rest: P.slice(1) };
      if (METHODS.includes(P[2])) return { where: `${P[2].toUpperCase()} ${P[1]}`, rest: pretty(noProps(P.slice(3))) };
      return { where: P[1], rest: pretty(noProps(P.slice(2))) };
    }
    const i2 = nameAt(P);
    if (i2 < 0) return { where: P[0], rest: noProps(P.slice(1)) };
    const sec = P[i2 - 1];
    const isSchema = sec === "definitions" || sec === "schemas";
    if (P.length === i2 + 1 && !asObject) return { where: isSchema ? "schemas" : sec, rest: [P[i2]] };
    if (!isSchema) return { where: compLabel(P.slice(0, i2 + 1)), rest: noProps(P.slice(i2 + 1)) };
    const parts = [P[i2]];
    let lastPair;
    for (let j = i2 + 1; j < P.length; j++) {
      if (P[j] === "properties" && j + 1 < P.length) {
        lastPair = parts.length;
        parts.push(P[++j]);
      } else parts.push(P[j]);
    }
    if (asObject) return { where: parts.join("."), rest: [] };
    const cut = lastPair ?? 1;
    return { where: parts.slice(0, cut).join("."), rest: parts.slice(cut) };
  }
  var tagOf = (p) => [...p].map(String).reverse().find((s2) => !/^\d+$/.test(s2)) ?? "other";
  function emit(kind, text, ctx, tag = tagOf(ctx.path), where = locate(ctx).where, vals) {
    const st = ctx.st;
    const side = kind === "removed" ? "left" : "right";
    const line = lineOf(st[side], side === "left" ? ctx.pl : ctx.pr);
    const affects = st.detail ? [] : affectsOf(ctx);
    const ch = { kind, tag, text, where, path: ctx.path.map(String), side, line, left: rangeOf(st.left, ctx.pl), right: rangeOf(st.right, ctx.pr), affects, flash: flashOf(ctx) };
    ch.breaking = isBreaking(ch, st.detail ? st.dirs : dirsOf(affects), vals);
    st.changes.push(ch);
    return ch;
  }
  var dirsOf = (affects) => new Set(affects.map((a2) => a2.dir));
  function affectsOf(ctx) {
    const P = ctx.path.map(String);
    const st = ctx.st;
    if (P[0] === "paths" && P.length > 1) {
      const op2 = METHODS.includes(P[2]);
      const k = op2 ? P[3] : P[2];
      const dir = k === "parameters" || k === "requestBody" ? "request" : k === "responses" ? "response" : "endpoint";
      const item2 = (d) => isPlain(d?.paths) && isPlain(get(d.paths, P[1])) ? d.paths[P[1]] : {};
      const methods = op2 ? [P[2]] : METHODS.filter((m2) => has(item2(st.lData), m2) || has(item2(st.rData), m2));
      return methods.map((m2) => ({ endpoint: `${m2.toUpperCase()} ${P[1]}`, dir }));
    }
    const i2 = nameAt(P);
    if (i2 < 0) return [];
    const key = JSON.stringify(P.slice(0, i2 + 1));
    if (!st.affects.has(key)) st.affects.set(key, componentAffects(st.useL.get(key) ?? [], st.useR.get(key) ?? []));
    return st.affects.get(key);
  }
  function componentAffects(useL, useR) {
    const out = /* @__PURE__ */ new Map();
    for (const a2 of [...useL, ...useR]) {
      const k = `${a2.endpoint}|${a2.dir}`;
      if (!out.has(k)) out.set(k, { endpoint: a2.endpoint, dir: a2.dir, vias: [] });
      const vias = out.get(k).vias;
      if (!vias.includes(a2.via)) vias.push(a2.via);
    }
    const head2 = (v2) => /^(response|parameter) /.exec(v2)?.[0];
    return [...out.values()].map(({ endpoint, dir, vias }) => ({
      endpoint,
      via: vias.map((v2, j) => j && head2(v2) && head2(v2) === head2(vias[j - 1]) ? v2.slice(head2(v2).length) : v2).join(", "),
      dir
    }));
  }
  function flashOf(ctx) {
    const flash = {};
    for (const [side, p] of [["left", ctx.pl], ["right", ctx.pr]]) {
      const own = ["$ref", ...KW].includes(p.at(-1)) ? p.slice(0, -1) : p;
      const key = ctx.st[side].get(JSON.stringify(own))?.key;
      if (key) flash[side] = key;
    }
    return flash;
  }
  var MINS = ["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"];
  var MAXS = ["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"];
  function isBreaking(c, dirs, { lv, rv, details, enums } = {}) {
    if (!dirs?.size || inValue(c.path)) return false;
    const req = dirs.has("request");
    const res = dirs.has("response");
    const { kind, tag } = c;
    if (tag === "refactor") return !!details?.some((d) => d.breaking);
    if (kind === "removed" && (tag === "endpoint" || tag === "response")) return true;
    if (kind === "removed" && c.path.at(-2) === "content" && !NAMES.includes(c.path.at(-3))) return true;
    if (tag === "type" || tag === "$ref") return kind === "changed";
    if (tag === "parameter") return kind === "added" && (rv?.required === true || rv?.in === "path");
    if (tag === "requestBody") return kind === "added" && rv?.required === true;
    if (tag === "required") {
      if (/now required$/.test(c.text) || rv === true) return req;
      if (/no longer required$/.test(c.text) || lv === true) return res;
      return false;
    }
    if (tag === "property") return kind === "removed" && res;
    if (tag === "enum") {
      const whole = c.path.at(-1) === "enum";
      const [l2, r] = enums ?? [[], []];
      const missing = (a2, b2) => a2.some((v2) => !b2.some((w) => eq(v2, w)));
      const narrowed = whole ? kind === "added" : missing(l2, r);
      const widened = whole ? kind === "removed" : missing(r, l2);
      return narrowed && req || widened && res;
    }
    if (tag === "pattern" || MINS.includes(tag) || MAXS.includes(tag)) {
      const tighter = kind === "added" || kind === "changed" && (tag === "pattern" || (MINS.includes(tag) ? rv > lv : rv < lv));
      return tighter && req;
    }
    return false;
  }
  var NAMES = ["properties", "headers", "definitions", "schemas", "parameters", "responses", "required"];
  var VALUES = ["example", "examples", "default"];
  var inValue = (path) => path.some(
    (s2, i2) => !NAMES.includes(path[i2 - 1]) && (VALUES.includes(s2) || s2.startsWith("x-") || s2 === "enum" && i2 < path.length - 2)
  );
  var restOf = (ctx) => locate(ctx).rest.join(".");
  var ownWhere = (ctx) => compLabel(ctx.path.map(String)) ? locate(ctx, true).where : void 0;
  function walk(l2, r, ctx) {
    if (eq(l2, r)) return;
    const vals = { lv: l2, rv: r, enums: ctx.enums };
    if (l2 === void 0) return emit("added", restOf(ctx) ? `${restOf(ctx)} added` : "Added", ctx, void 0, void 0, vals);
    if (r === void 0) return emit("removed", restOf(ctx) ? `${restOf(ctx)} removed` : "Removed", ctx, void 0, void 0, vals);
    if (extract(l2, r, ctx)) return;
    if (compose(l2, r, ctx)) return;
    if (isPlain(l2) && isPlain(r)) return walkObject(l2, r, ctx);
    if (Array.isArray(l2) && Array.isArray(r)) {
      const ac = ctx.path.at(-1) === "enum" ? { ...ctx, enums: [l2, r] } : ctx;
      for (let i2 = 0; i2 < Math.max(l2.length, r.length); i2++) walk(l2[i2], r[i2], child(ac, i2));
      return;
    }
    const p = restOf(ctx);
    emit("changed", `${p ? `${p}: ` : ""}${fmt(l2)} \u2192 ${fmt(r)}`, ctx, void 0, void 0, vals);
  }
  function walkObject(l2, r, ctx) {
    const P = ctx.st.detail ? [] : ctx.path;
    const isPaths = P.length === 1 && P[0] === "paths";
    const isPathItem = P.length === 2 && P[0] === "paths";
    const isOp = P.length === 3 && P[0] === "paths";
    const isResponses = P.length === 4 && P[0] === "paths" && P[3] === "responses";
    const isSchemas = P.length === 1 && P[0] === "definitions" || P.length === 2 && P[0] === "components" && P[1] === "schemas";
    const keys = [...Object.keys(r), ...Object.keys(l2).filter((k) => !has(r, k))];
    for (const k of keys) {
      const lv = get(l2, k);
      const rv = get(r, k);
      const oneSided = lv === void 0 || rv === void 0;
      const kind = lv === void 0 ? "added" : "removed";
      const verb = lv === void 0 ? "Added" : "Removed";
      const c = child(ctx, k);
      if (isPaths && oneSided) {
        const item2 = lv ?? rv;
        const methods = isPlain(item2) ? METHODS.filter((m2) => has(item2, m2)) : [];
        if (!methods.length) walk(lv, rv, c);
        for (const m2 of methods) emit(kind, `${verb} endpoint`, child(c, m2), "endpoint");
      } else if (isPathItem && oneSided && METHODS.includes(k)) {
        emit(kind, `${verb} endpoint`, c, "endpoint");
      } else if ((isPathItem || isOp) && k === "parameters" && [lv, rv].every((v2) => v2 === void 0 || Array.isArray(v2))) {
        walkParams(lv ?? [], rv ?? [], ctx);
      } else if (isResponses && oneSided) {
        emit(kind, `${verb} response ${k}`, c, "response");
      } else if (isSchemas && oneSided) {
        emit(kind, `${verb} schema ${k}`, c, "schema");
      } else if (isSchemas) {
        walk(lv, rv, c);
      } else if (k === "properties" && [lv, rv].every((v2) => v2 === void 0 || isPlain(v2))) {
        walkProps(lv ?? {}, rv ?? {}, ctx);
      } else if (k === "required" && [lv, rv].every((v2) => v2 === void 0 || Array.isArray(v2))) {
        walkRequired(lv ?? [], rv ?? [], ctx, l2, r);
      } else {
        walk(lv, rv, c);
      }
    }
  }
  var pureRef = (v2) => isPlain(v2) && typeof v2.$ref === "string" && Object.keys(v2).length === 1;
  function pointer(ref) {
    if (!ref.startsWith("#/")) return void 0;
    return ref.slice(2).split("/").map((s2) => {
      s2 = s2.replace(/~1/g, "/").replace(/~0/g, "~");
      try {
        return decodeURIComponent(s2);
      } catch {
        return s2;
      }
    });
  }
  function resolve(doc, segs) {
    for (let hop = 0; hop < 10 && segs; hop++) {
      let v2 = doc;
      for (const s2 of segs) v2 = v2 !== null && typeof v2 === "object" && has(v2, s2) ? v2[s2] : void 0;
      if (!pureRef(v2)) return isPlain(v2) ? v2 : void 0;
      segs = pointer(v2.$ref);
    }
    return void 0;
  }
  function extract(l2, r, ctx, label2) {
    const st = ctx.st;
    if (st.detail || !isPlain(l2) || !isPlain(r)) return false;
    const ext = pureRef(r) && !has(l2, "$ref");
    if (!ext && !(pureRef(l2) && !has(r, "$ref"))) return false;
    const ref = (ext ? r : l2).$ref;
    const segs = pointer(ref);
    const target = segs && resolve(ext ? st.rData : st.lData, segs);
    let details;
    const sink = [];
    if (!segs) details = ["definition not compared (external $ref)"];
    else if (!target) details = ["definition not compared (unresolved $ref)"];
    else {
      walk(ext ? l2 : target, ext ? target : r, { path: [], pl: [], pr: [], st: { ...st, changes: sink, detail: true, dirs: dirsOf(affectsOf(ctx)) } });
      details = sink.length ? sink.map((c) => c.text) : ["definition unchanged"];
    }
    const text = `${label2 ?? restOf(ctx)}: ${ext ? "extracted to" : "inlined from"} ${(segs && compLabel(segs)) ?? ref}`;
    emit("changed", text, ext ? { ...ctx, pr: [...ctx.pr, "$ref"] } : ctx, "refactor", ownWhere(ctx), { details: sink }).details = details;
    if (target && compLabel(segs)) (ext ? st.extracted : st.inlined).add(JSON.stringify(segs));
    return true;
  }
  var KW = ["allOf", "oneOf", "anyOf"];
  var compOf = (s2) => KW.find((k) => Array.isArray(s2[k]));
  var refsOf = (arr) => [...new Set(arr.filter(pureRef).map((m2) => m2.$ref))].sort();
  var refName = (ref) => {
    const segs = pointer(ref);
    return (segs && compLabel(segs)) ?? ref;
  };
  var isUnion = (s2, k) => k !== void 0 && k !== "allOf" && s2[k].length > 1;
  function merge2(a2, b2) {
    const out = { ...a2 };
    for (const [k, v2] of Object.entries(b2)) {
      if (k === "properties" && isPlain(v2) && isPlain(out.properties)) {
        out.properties = { ...out.properties };
        for (const [n2, p] of Object.entries(v2)) {
          const q = out.properties[n2];
          out.properties[n2] = has(out.properties, n2) && isPlain(q) && isPlain(p) ? merge2(q, p) : p;
        }
      } else if (k === "required" && Array.isArray(v2) && Array.isArray(out.required)) {
        out.required = [.../* @__PURE__ */ new Set([...out.required, ...v2])];
      } else out[k] = v2;
    }
    return out;
  }
  function flat(s2, doc, seen = /* @__PURE__ */ new Set()) {
    if (!isPlain(s2)) return {};
    if (pureRef(s2)) {
      const segs = pointer(s2.$ref);
      const key = JSON.stringify(segs);
      if (!segs || seen.has(key) || seen.size >= 32) return {};
      return flat(resolve(doc, segs), doc, /* @__PURE__ */ new Set([...seen, key]));
    }
    const k = compOf(s2);
    if (!k || k !== "allOf" && s2[k].length !== 1) return s2;
    return merge2(s2[k].reduce((acc, m2) => merge2(acc, flat(m2, doc, seen)), {}), omit(s2, k));
  }
  function compose(l2, r, ctx, label2) {
    const st = ctx.st;
    if (st.detail || !isPlain(l2) || !isPlain(r)) return false;
    const cl = compOf(l2);
    const cr = compOf(r);
    if (!cl && !cr) return false;
    if (cl === cr && eq(refsOf(l2[cl]), refsOf(r[cr]))) return false;
    const sink = [];
    const dctx = { path: [], pl: [], pr: [], st: { ...st, changes: sink, detail: true, dirs: dirsOf(affectsOf(ctx)) } };
    const union = isUnion(l2, cl) || isUnion(r, cr);
    if (union) walk(l2, r, dctx);
    else walk(flat(l2, st.lData), flat(r, st.rData), dctx);
    const details = sink.length ? sink.map((c) => c.text) : ["definition unchanged"];
    const desc = (m2) => pureRef(m2) ? refName(m2.$ref) : "inline";
    let what;
    if (!cr) what = `${cl} flattened`;
    else if (cl === cr) {
      const [lr, rr] = [refsOf(l2[cl]), refsOf(r[cr])];
      const ch2 = [...rr.filter((x) => !lr.includes(x)).map((x) => `+ ${refName(x)}`), ...lr.filter((x) => !rr.includes(x)).map((x) => `\u2212 ${refName(x)}`)];
      what = `${cr} members changed: ${ch2.join(", ")}`;
    } else what = `now ${cr} [${r[cr].map(desc).join(cr === "allOf" ? " + " : ", ")}]`;
    const ch = emit("changed", `${label2 ?? restOf(ctx)}: ${what}`, cr ? { ...ctx, pr: [...ctx.pr, cr] } : ctx, "refactor", ownWhere(ctx), { details: sink });
    ch.details = details;
    if (!cr) {
      ch.side = "left";
      ch.line = lineOf(st.left, [...ctx.pl, cl]);
      ch.left = rangeOf(st.left, [...ctx.pl, cl]);
    }
    if (union) return true;
    for (const [s2, k, doc, other, set2] of [
      [l2, cl, st.lData, st.rData, st.inlined],
      [r, cr, st.rData, st.lData, st.extracted]
    ]) {
      for (const ref of k ? refsOf(s2[k]) : []) {
        const segs = pointer(ref);
        if (segs && compLabel(segs) && resolve(doc, segs) && !resolve(other, segs)) set2.add(JSON.stringify(segs));
      }
    }
    return true;
  }
  var label = (p) => !isPlain(p) ? void 0 : p.$ref ? `$ref ${p.$ref}` : p.in != null && p.name != null ? `${p.in} '${p.name}'` : void 0;
  var fromSchema = (p) => isPlain(p?.schema) && stype(p.schema) !== void 0;
  var ptype = (p) => fromSchema(p) ? stype(p.schema) : p?.type;
  var omit = (o2, k) => {
    const { [k]: _, ...rest } = o2;
    return rest;
  };
  function stripParam(p) {
    if (!isPlain(p)) return p;
    const { required, ...rest } = p;
    if (!fromSchema(p)) delete rest.type;
    if (isPlain(rest.schema)) {
      const schema4 = stripSchema(rest.schema);
      if (Object.keys(schema4).length) rest.schema = schema4;
      else delete rest.schema;
    }
    return rest;
  }
  function byLabel(arr) {
    const m2 = /* @__PURE__ */ new Map();
    const rest = [];
    arr.forEach((p, i2) => {
      const lab = label(p);
      if (lab === void 0) return rest.push(i2);
      let key = lab;
      let n2 = "";
      for (let k = 2; m2.has(key); k++) key = lab + (n2 = `#${k}`);
      m2.set(key, { i: i2, n: n2 });
    });
    return { m: m2, rest };
  }
  function pairRefs(m2, arr, doc, other) {
    for (const [k, v2] of [...m2]) {
      const p = arr[v2.i];
      if (other.has(k) || !pureRef(p)) continue;
      const t = pointer(p.$ref) && resolve(doc, pointer(p.$ref));
      const key = t?.in != null && t.name != null ? `${t.in} '${t.name}'` : void 0;
      if (key === void 0 || m2.has(key) || !other.has(key)) continue;
      m2.delete(k);
      m2.set(key, { i: v2.i, n: "" });
    }
  }
  function walkParams(lArr, rArr, ctx) {
    const { m: lm, rest: lRest } = byLabel(lArr);
    const { m: rm, rest: rRest } = byLabel(rArr);
    pairRefs(rm, rArr, ctx.st.rData, lm);
    pairRefs(lm, lArr, ctx.st.lData, rm);
    const pc = child(ctx, "parameters");
    const labels = [...rm.keys(), ...[...lm.keys()].filter((k) => !rm.has(k))];
    for (const lab of labels) {
      const { i: il, n: n2 } = lm.get(lab) ?? {};
      const { i: ir } = rm.get(lab) ?? {};
      const lp = lArr[il];
      const rp = rArr[ir];
      const p = [lp, rp].find((q) => q && !q.$ref) ?? lp ?? rp;
      const shown = (p.$ref ? p.$ref : `${p.in}:${p.name}`) + (n2 ?? rm.get(lab).n);
      const c = child(pc, shown, { l: il, r: ir });
      const nm = p.name ?? lab;
      if (il === void 0) emit("added", `Added parameter ${lab}`, c, "parameter", void 0, { rv: pureRef(rp) ? resolve(ctx.st.rData, pointer(rp.$ref)) : rp });
      else if (ir === void 0) emit("removed", `Removed parameter ${lab}`, c, "parameter");
      else {
        if (extract(lp, rp, c, nm)) continue;
        let [ls, rs] = [lp, rp];
        const sc = child(c, "schema");
        if (extract(lp.schema, rp.schema, sc, p.name) || compose(lp.schema, rp.schema, sc, p.name)) [ls, rs] = [omit(lp, "schema"), omit(rp, "schema")];
        if (!!lp.required !== !!rp.required) emit("changed", `${nm}: ${rp.required ? "now required" : "no longer required"}`, c, "required");
        if (!eq(ptype(ls), ptype(rs))) emit("changed", `${nm}: type ${tfmt(ptype(ls))} \u2192 ${tfmt(ptype(rs))}`, c, "type");
        walk(stripParam(ls), stripParam(rs), c);
      }
    }
    for (let j = 0; j < Math.max(lRest.length, rRest.length); j++) {
      const il = lRest[j];
      const ir = rRest[j];
      walk(lArr[il], rArr[ir], child(pc, il ?? ir, { l: il, r: ir }));
    }
  }
  var tkey = (s2) => isPlain(s2) && s2.type !== void 0 ? "type" : "$ref";
  var stype = (s2) => isPlain(s2) ? s2[tkey(s2)] : void 0;
  var tfmt = (t) => typeof t === "string" || t === void 0 ? String(t) : JSON.stringify(t);
  var stripSchema = (s2) => isPlain(s2) ? omit(s2, tkey(s2)) : s2;
  function walkProps(lProps, rProps, ctx) {
    const pc = child(ctx, "properties");
    const names = [...Object.keys(rProps), ...Object.keys(lProps).filter((k) => !has(rProps, k))];
    for (const n2 of names) {
      const lv = get(lProps, n2);
      const rv = get(rProps, n2);
      const c = child(pc, n2);
      const p = restOf(c);
      const t = stype(lv ?? rv);
      const suffix = t === void 0 ? "" : ` (${tfmt(t)})`;
      if (lv === void 0) emit("added", `Added property ${p}${suffix}`, c, "property");
      else if (rv === void 0) emit("removed", `Removed property ${p}${suffix}`, c, "property");
      else if (!extract(lv, rv, c) && !compose(lv, rv, c)) {
        if (!eq(stype(lv), stype(rv))) emit("changed", `${p}: type ${tfmt(stype(lv))} \u2192 ${tfmt(stype(rv))}`, c, "type");
        walk(stripSchema(lv), stripSchema(rv), c);
      }
    }
  }
  function walkRequired(lArr, rArr, ctx, lObj, rObj) {
    const { where, rest } = locate(ctx, true);
    const nm = (n2) => [...rest, n2].join(".");
    const ls = new Set(lArr);
    const rs = new Set(rArr);
    const props = (obj) => isPlain(obj.properties) ? obj.properties : {};
    const lProps = props(lObj);
    const rProps = props(rObj);
    const at = (n2, pl, pr) => ({ ...ctx, path: [...ctx.path, "required", String(n2)], pl, pr });
    rArr.forEach((n2, i2) => {
      if (!ls.has(n2) && rArr.indexOf(n2) === i2) emit("changed", `${nm(n2)}: now required`, at(n2, [...ctx.pl, "required"], [...ctx.pr, "required", i2]), "required", where);
    });
    for (const n2 of ls) {
      if (rs.has(n2) || has(lProps, n2) && !has(rProps, n2)) continue;
      const pr = has(rProps, n2) ? [...ctx.pr, "properties", n2] : [...ctx.pr, "required"];
      emit("changed", `${nm(n2)}: no longer required`, at(n2, [...ctx.pl, "required", lArr.indexOf(n2)], pr), "required", where);
    }
  }
  function usage(data) {
    const use = /* @__PURE__ */ new Map();
    const direct = /* @__PURE__ */ new Map();
    const closure = /* @__PURE__ */ new Map();
    const refsIn = (node, out = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set()) => {
      if (node === null || typeof node !== "object" || seen.has(node)) return out;
      seen.add(node);
      const segs = isPlain(node) && typeof node.$ref === "string" ? pointer(node.$ref) : void 0;
      const i2 = segs ? nameAt(segs) : -1;
      if (i2 > 0) out.add(JSON.stringify(segs.slice(0, i2 + 1)));
      for (const v2 of Object.values(node)) refsIn(v2, out, seen);
      return out;
    };
    const from = (start) => {
      if (closure.has(start)) return closure.get(start);
      const seen = /* @__PURE__ */ new Set();
      const todo = [start];
      while (todo.length) {
        const k = todo.pop();
        if (seen.has(k)) continue;
        seen.add(k);
        if (!direct.has(k)) direct.set(k, refsIn(JSON.parse(k).reduce((v2, s2) => isPlain(v2) ? get(v2, s2) : void 0, data)));
        todo.push(...direct.get(k));
      }
      closure.set(start, seen);
      return seen;
    };
    const reach = (node) => {
      const out = /* @__PURE__ */ new Set();
      for (const k of refsIn(node)) for (const x of from(k)) out.add(x);
      return out;
    };
    for (const [p, item2] of Object.entries(isPlain(data?.paths) ? data.paths : {})) {
      if (!isPlain(item2)) continue;
      const shared = Array.isArray(item2.parameters) ? item2.parameters : [];
      for (const m2 of METHODS.filter((m3) => isPlain(get(item2, m3)))) {
        const op2 = item2[m2];
        const endpoint = `${m2.toUpperCase()} ${p}`;
        const parts = [...shared, ...Array.isArray(op2.parameters) ? op2.parameters : []].map((prm) => {
          const t = pureRef(prm) ? resolve(data, pointer(prm.$ref)) : prm;
          return [`parameter ${t?.name ?? prm?.$ref ?? "?"}`, "request", prm];
        });
        if (op2.requestBody !== void 0) parts.push(["request body", "request", op2.requestBody]);
        for (const [code, r] of Object.entries(isPlain(op2.responses) ? op2.responses : {})) parts.push([`response ${code}`, "response", r]);
        for (const [via, dir, node] of parts) {
          for (const k of reach(node)) {
            if (!use.has(k)) use.set(k, /* @__PURE__ */ new Map());
            const m3 = use.get(k);
            const id = `${endpoint}|${via}`;
            if (!m3.has(id)) m3.set(id, { endpoint, via, dir });
          }
        }
      }
    }
    return new Map([...use].map(([k, m2]) => [k, [...m2.values()]]));
  }

  // src/report.js
  var pair = (a2, b2) => a2 == null || a2 === b2 ? b2 ?? "" : b2 == null ? a2 : `${a2} \u2192 ${b2}`;
  function heading(meta) {
    const l2 = meta?.left ?? {};
    const r = meta?.right ?? {};
    const ver = (v2) => v2?.replace(/^v/i, "");
    return [pair(l2.title, r.title), pair(ver(l2.version), ver(r.version))].filter(Boolean).join("  ");
  }
  var schemaOf = (p) => p[0] === "definitions" ? p[1] : p[0] === "components" && p[1] === "schemas" ? p[2] : void 0;
  function counts(changes, ofKind, keyOf2) {
    const added = /* @__PURE__ */ new Set();
    const removed = /* @__PURE__ */ new Set();
    const changed = /* @__PURE__ */ new Set();
    for (const c of changes) {
      for (const k of keyOf2(c)) {
        if (ofKind(c) && c.kind === "added") added.add(k);
        else if (ofKind(c) && c.kind === "removed") removed.add(k);
        else changed.add(k);
      }
    }
    const parts = [];
    if (added.size) parts.push(`${added.size} added`);
    if (removed.size) parts.push(`${removed.size} removed`);
    const n2 = [...changed].filter((k) => !added.has(k) && !removed.has(k)).length;
    if (n2) parts.push(`${n2} changed`);
    return parts.join(" \xB7 ");
  }
  function summary(changes) {
    if (!changes.length) return "No changes";
    const eps = counts(changes, (c) => c.tag === "endpoint", (c) => c.affects.map((a2) => a2.endpoint));
    const schemaKey = (c) => schemaOf(c.path) === void 0 ? [] : [schemaOf(c.path)];
    const sch = counts(changes, (c) => c.tag === "schema", schemaKey);
    const nb = changes.filter((c) => c.breaking).length;
    return [eps && `Endpoints: ${eps}`, sch && `Schemas: ${sch}`, nb && `\u26A0 ${nb} breaking`].filter(Boolean).join(" \xB7 ");
  }
  function byEndpoint(changes) {
    const groups = /* @__PURE__ */ new Map();
    const other = [];
    for (const c of changes) {
      if (!c.affects.length) other.push({ c, text: c.text });
      const vias = /* @__PURE__ */ new Map();
      for (const a2 of c.affects) {
        if (!vias.has(a2.endpoint)) vias.set(a2.endpoint, []);
        if (a2.via) vias.get(a2.endpoint).push(a2.via);
      }
      for (const [key, v2] of vias) {
        if (!groups.has(key)) groups.set(key, { key, rows: [] });
        groups.get(key).rows.push({ c, text: v2.length ? `${v2.join(", ")} \u203A ${c.text}` : c.text });
      }
    }
    return [...groups.values(), ...other.length ? [{ key: "Other", rows: other }] : []];
  }
  var item = (text, c) => [`- ${c.breaking ? "\u26A0 " : ""}${text}`, ...(c.details ?? []).map((d) => `  - ${d}`)];
  function markdown(res) {
    const title = `# ${heading(res.meta) || "API changes"}`;
    if (res.error) return `${title}

The ${res.error.side} spec can't be parsed: line ${res.error.line}: ${res.error.message}
`;
    const out = [title, "", summary(res.changes)];
    const breaking = res.changes.filter((c) => c.breaking);
    if (breaking.length) out.push("", "## Breaking", "", ...breaking.map((c) => `- ${c.where}: ${c.text}`));
    for (const g of byEndpoint(res.changes)) {
      const other = g.key === "Other";
      out.push("", `## ${g.key}`, "", ...g.rows.flatMap(({ c, text }) => item(other ? `${c.where}: ${text}` : text, c)));
    }
    return out.join("\n") + "\n";
  }

  // src/oas/model.js
  var TEMPLATES = ["3.0.3", "3.1.1", "3.2.0"];
  var s = (doc, x) => ({ t: "str", doc, ...x });
  var b = (doc, x) => ({ t: "bool", doc, ...x });
  var n = (doc, x) => ({ t: "num", doc, ...x });
  var i = (doc, x) => ({ t: "int", doc, ...x });
  var a = (doc, x) => ({ t: "any", doc, ...x });
  var o = (of, doc, x) => ({ t: "obj", of, doc, ...x });
  var m = (of, doc, x) => ({ t: "map", of, doc, ...x });
  var l = (of, doc, x) => ({ t: "list", of, doc, ...x });
  var STATUS = ["200", "201", "204", "400", "401", "403", "404", "409", "422", "500", "default"];
  var MEDIA = ["application/json", "application/xml", "text/plain", "multipart/form-data", "application/x-www-form-urlencoded", "application/octet-stream"];
  var FORMATS = ["int32", "int64", "float", "double", "byte", "binary", "date", "date-time", "password", "email", "uri", "uuid"];
  var content = (doc) => m("MediaType", doc, { keyHints: MEDIA });
  var op = (name) => o("Operation", `The ${name.toUpperCase()} operation on this path.`);
  var schemaRef = (doc, x) => o("Schema", doc, x);
  var OBJECTS = {
    OpenAPI: {
      doc: "The root object of an OpenAPI document.",
      fields: {
        openapi: s("The OpenAPI Specification version this document uses.", { req: true, hints: TEMPLATES }),
        $self: s("The URI that identifies this document, used as the base for relative references.", { since: 32 }),
        info: o("Info", "Metadata about the API.", { req: true }),
        jsonSchemaDialect: s("The default JSON Schema dialect URI for Schema Objects in this document.", { since: 31 }),
        servers: l("Server", "The servers that host the API."),
        paths: o("Paths", "The available paths and their operations.", { req: true, reqUntil: 31 }),
        webhooks: m("PathItem", "Incoming requests the API consumer may receive, keyed by name.", { since: 31 }),
        components: o("Components", "Reusable objects referenced from elsewhere in the document."),
        security: l("SecurityRequirement", "Security requirements that apply to every operation by default."),
        tags: l("Tag", "Tags used to group operations, with extra metadata."),
        externalDocs: o("ExternalDocs", "A link to additional external documentation.")
      }
    },
    Info: {
      doc: "Metadata about the API.",
      fields: {
        title: s("The name of the API.", { req: true }),
        summary: s("A short summary of the API.", { since: 31 }),
        description: s("A longer description of the API; CommonMark is allowed."),
        termsOfService: s("A URL to the terms of service of the API."),
        contact: o("Contact", "Contact information for the API."),
        license: o("License", "License information for the API."),
        version: s("The version of this API document (not the OpenAPI version).", { req: true })
      }
    },
    Contact: {
      doc: "Contact information for the API.",
      fields: {
        name: s("The name of the contact person or organization."),
        url: s("A URL pointing to the contact information."),
        email: s("The email address of the contact.")
      }
    },
    License: {
      doc: "License information for the API.",
      fields: {
        name: s("The name of the license.", { req: true }),
        identifier: s("An SPDX license expression for the API.", { since: 31 }),
        url: s("A URL to the license text.")
      }
    },
    Server: {
      doc: "A server that hosts the API.",
      fields: {
        url: s("The server URL, which may contain {variables}.", { req: true }),
        description: s("A description of the server."),
        name: s("A short name for the server.", { since: 32 }),
        variables: m("ServerVariable", "Values for the variables in the server URL.")
      }
    },
    ServerVariable: {
      doc: "A variable used in a server URL template.",
      fields: {
        enum: l("str", "The allowed values of the variable."),
        default: s("The value used when no other value is supplied.", { req: true }),
        description: s("A description of the variable.")
      }
    },
    Paths: {
      doc: "The available paths, each starting with a slash.",
      fields: {},
      patterns: [{ re: /^\//, t: "obj", of: "PathItem", doc: "The operations available on this path." }]
    },
    PathItem: {
      doc: "The operations available on a single path.",
      ref: true,
      fields: {
        summary: s("A short summary that applies to all operations on this path."),
        description: s("A description that applies to all operations on this path."),
        get: op("get"),
        put: op("put"),
        post: op("post"),
        delete: op("delete"),
        options: op("options"),
        head: op("head"),
        patch: op("patch"),
        trace: op("trace"),
        query: o("Operation", "The QUERY operation on this path, a safe request that carries a body.", { since: 32 }),
        additionalOperations: m("Operation", "Operations for other HTTP methods, keyed by the method name in upper case.", { since: 32 }),
        servers: l("Server", "Servers that override the global ones for this path."),
        parameters: l("Parameter", "Parameters shared by all operations on this path.")
      }
    },
    Operation: {
      doc: "A single API operation on a path.",
      fields: {
        tags: l("str", "Tags used to group this operation."),
        summary: s("A short summary of what the operation does."),
        description: s("A longer explanation of the operation behavior."),
        externalDocs: o("ExternalDocs", "A link to additional documentation for this operation."),
        operationId: s("A unique identifier for the operation."),
        parameters: l("Parameter", "Parameters accepted by this operation."),
        requestBody: o("RequestBody", "The body this operation accepts."),
        responses: o("Responses", "The possible responses, keyed by status code.", { req: true, reqUntil: 31 }),
        callbacks: m("Callback", "Out-of-band callbacks related to this operation."),
        deprecated: b("Marks the operation as deprecated."),
        security: l("SecurityRequirement", "Security requirements that override the document default."),
        servers: l("Server", "Servers that override the global ones for this operation.")
      }
    },
    Parameter: {
      doc: "A single operation parameter, identified by name and location.",
      ref: true,
      fields: {
        name: s("The name of the parameter, case sensitive.", { req: true }),
        in: s("Where the parameter is sent.", { req: true, enum: ["query", "header", "path", "cookie", ["querystring", 32]] }),
        description: s("A description of the parameter."),
        required: b("Whether the parameter is mandatory; path parameters must set it to true."),
        deprecated: b("Marks the parameter as deprecated."),
        allowEmptyValue: b("Allows sending a query parameter with an empty value."),
        style: s("How the parameter value is serialized.", { enum: ["matrix", "label", "simple", "form", "spaceDelimited", "pipeDelimited", "deepObject", ["cookie", 32]] }),
        explode: b("Whether arrays and objects produce a separate parameter per item."),
        allowReserved: b("Whether reserved characters are sent without percent-encoding."),
        schema: schemaRef("The schema of the parameter value."),
        example: a("An example value of the parameter."),
        examples: m("Example", "Named examples of the parameter value."),
        content: content("The parameter representation, keyed by a single media type.")
      }
    },
    RequestBody: {
      doc: "The body of a request.",
      ref: true,
      fields: {
        description: s("A description of the request body."),
        content: content("The body content, keyed by media type."),
        required: b("Whether the body is mandatory.")
      }
    },
    MediaType: {
      doc: "The schema and examples for one media type.",
      ref: true,
      fields: {
        schema: schemaRef("The schema of the content."),
        itemSchema: schemaRef("The schema of each item in a sequential media type such as JSON Lines.", { since: 32 }),
        example: a("An example of the content."),
        examples: m("Example", "Named examples of the content."),
        encoding: m("Encoding", "Encoding of individual properties, keyed by property name."),
        prefixEncoding: l("Encoding", "Encoding of the leading items of a multipart body, by position.", { since: 32 }),
        itemEncoding: o("Encoding", "Encoding applied to every item of a multipart body.", { since: 32 })
      }
    },
    Encoding: {
      doc: "How a single property of a multipart or form body is encoded.",
      fields: {
        contentType: s("The content type of the property."),
        headers: m("Header", "Extra headers for a multipart part."),
        style: s("How the property value is serialized.", { enum: ["form", "spaceDelimited", "pipeDelimited", "deepObject"] }),
        explode: b("Whether arrays and objects produce a separate value per item."),
        allowReserved: b("Whether reserved characters are sent without percent-encoding."),
        encoding: m("Encoding", "Encoding of nested properties, keyed by property name.", { since: 32 }),
        prefixEncoding: l("Encoding", "Encoding of the leading nested items, by position.", { since: 32 }),
        itemEncoding: o("Encoding", "Encoding applied to every nested item.", { since: 32 })
      }
    },
    Responses: {
      doc: "The possible responses of an operation, keyed by HTTP status code.",
      fields: {
        default: o("Response", "The response for any status code not listed explicitly.")
      },
      patterns: [{ re: /^[1-5](?:\d\d|XX)$/, t: "obj", of: "Response", doc: "The response for this HTTP status code.", keyHints: STATUS }]
    },
    Response: {
      doc: "A single response of an operation.",
      ref: true,
      fields: {
        summary: s("A short summary of the response.", { since: 32 }),
        description: s("A description of the response.", { req: true, reqUntil: 32 }),
        headers: m("Header", "Response headers, keyed by header name."),
        content: content("The response body, keyed by media type."),
        links: m("Link", "Links to other operations, keyed by name.")
      }
    },
    Header: {
      doc: "A header sent with a request or response.",
      ref: true,
      fields: {
        description: s("A description of the header."),
        required: b("Whether the header is mandatory."),
        deprecated: b("Marks the header as deprecated."),
        allowEmptyValue: b("Allows an empty header value."),
        style: s("How the header value is serialized.", { enum: ["simple"] }),
        explode: b("Whether arrays and objects produce a separate value per item."),
        allowReserved: b("Whether reserved characters are sent without percent-encoding."),
        schema: schemaRef("The schema of the header value."),
        example: a("An example of the header value."),
        examples: m("Example", "Named examples of the header value."),
        content: content("The header representation, keyed by a single media type.")
      }
    },
    Components: {
      doc: "Reusable objects that other parts of the document reference.",
      fields: {
        schemas: m("Schema", "Reusable schemas, keyed by name."),
        responses: m("Response", "Reusable responses, keyed by name."),
        parameters: m("Parameter", "Reusable parameters, keyed by name."),
        examples: m("Example", "Reusable examples, keyed by name."),
        requestBodies: m("RequestBody", "Reusable request bodies, keyed by name."),
        headers: m("Header", "Reusable headers, keyed by name."),
        securitySchemes: m("SecurityScheme", "Reusable security schemes, keyed by name."),
        links: m("Link", "Reusable links, keyed by name."),
        callbacks: m("Callback", "Reusable callbacks, keyed by name."),
        pathItems: m("PathItem", "Reusable path items, keyed by name.", { since: 31 }),
        mediaTypes: m("MediaType", "Reusable media type objects, keyed by name.", { since: 32 })
      }
    },
    Schema: {
      doc: "A data type definition based on JSON Schema.",
      ref: true,
      fields: {
        title: s("A short title for the schema."),
        description: s("A description of the data."),
        type: s("The data type.", { of: "str", enum: ["string", "number", "integer", "boolean", "array", "object", ["null", 31]], tFrom: [31, "str|list"] }),
        format: s("A hint about the exact data format, such as int64 or date-time.", { hints: FORMATS }),
        enum: l("any", "The fixed set of allowed values."),
        const: a("The single allowed value.", { since: 31 }),
        default: a("The value assumed when none is supplied."),
        nullable: b("Allows null in addition to the declared type.", { until: 31 }),
        multipleOf: n("The number must be a multiple of this value."),
        maximum: n("The inclusive upper bound of a number."),
        exclusiveMaximum: b("Makes maximum exclusive.", { tFrom: [31, "num"] }),
        minimum: n("The inclusive lower bound of a number."),
        exclusiveMinimum: b("Makes minimum exclusive.", { tFrom: [31, "num"] }),
        maxLength: i("The maximum length of a string."),
        minLength: i("The minimum length of a string."),
        pattern: s("A regular expression the string must match."),
        maxItems: i("The maximum number of array items."),
        minItems: i("The minimum number of array items."),
        uniqueItems: b("Requires all array items to be distinct."),
        maxProperties: i("The maximum number of object properties."),
        minProperties: i("The minimum number of object properties."),
        required: l("str", "The names of properties that must be present."),
        properties: m("Schema", "The schemas of the object properties, keyed by name."),
        additionalProperties: { t: "bool|obj", of: "Schema", doc: "The schema for properties not listed, or false to forbid them." },
        patternProperties: m("Schema", "Schemas for properties whose names match a regular expression.", { since: 31 }),
        propertyNames: schemaRef("A schema every property name must match.", { since: 31 }),
        unevaluatedProperties: { t: "bool|obj", of: "Schema", doc: "The schema for properties no other keyword evaluated.", since: 31 },
        dependentRequired: a("Properties that become required when a given property is present.", { since: 31 }),
        dependentSchemas: m("Schema", "Schemas that apply when a given property is present.", { since: 31 }),
        items: schemaRef("The schema of the array items.", { tFrom: [31, "obj|bool"] }),
        prefixItems: l("Schema", "Schemas for the leading array items, by position.", { since: 31 }),
        unevaluatedItems: { t: "bool|obj", of: "Schema", doc: "The schema for array items no other keyword evaluated.", since: 31 },
        contains: schemaRef("A schema at least one array item must match.", { since: 31 }),
        minContains: i("The minimum number of items that match contains.", { since: 31 }),
        maxContains: i("The maximum number of items that match contains.", { since: 31 }),
        allOf: l("Schema", "The data must match all of these schemas."),
        oneOf: l("Schema", "The data must match exactly one of these schemas."),
        anyOf: l("Schema", "The data must match at least one of these schemas."),
        not: schemaRef("The data must not match this schema."),
        if: schemaRef("A condition schema that selects then or else.", { since: 31 }),
        then: schemaRef("The schema applied when if matches.", { since: 31 }),
        else: schemaRef("The schema applied when if does not match.", { since: 31 }),
        discriminator: o("Discriminator", "Selects the matching oneOf/anyOf schema from a property value."),
        readOnly: b("The property is only sent in responses."),
        writeOnly: b("The property is only sent in requests."),
        xml: o("XML", "Details for the XML representation."),
        externalDocs: o("ExternalDocs", "A link to additional documentation for this schema."),
        example: a("An example value of the schema."),
        examples: l("any", "A list of example values of the schema.", { since: 31 }),
        deprecated: b("Marks the schema as deprecated."),
        contentMediaType: s("The media type of string content.", { since: 31 }),
        contentEncoding: s("The encoding of string content, such as base64.", { since: 31 }),
        contentSchema: schemaRef("The schema of the decoded string content.", { since: 31 }),
        $id: s("The URI that identifies this schema.", { since: 31 }),
        $schema: s("The JSON Schema dialect of this schema.", { since: 31 }),
        $anchor: s("A plain-name anchor for referencing this schema.", { since: 31 }),
        $dynamicAnchor: s("A dynamic anchor for extensible recursive schemas.", { since: 31 }),
        $dynamicRef: s("A reference resolved through dynamic anchors.", { since: 31 }),
        $defs: m("Schema", "Local schema definitions, keyed by name.", { since: 31 }),
        $comment: s("A comment for schema authors, ignored by tools.", { since: 31 })
      }
    },
    Discriminator: {
      doc: "Tells which schema applies based on the value of one property.",
      fields: {
        propertyName: s("The property whose value selects the schema.", { req: true }),
        mapping: m("str", "Maps property values to schema names or references."),
        defaultMapping: s("The schema used when the property value has no mapping.", { since: 32 })
      }
    },
    XML: {
      doc: "Details for the XML representation of a schema.",
      fields: {
        nodeType: s("The kind of XML node this schema maps to.", { since: 32, enum: ["element", "attribute", "text", "cdata", "none"] }),
        name: s("The element or attribute name."),
        namespace: s("The absolute URI of the XML namespace."),
        prefix: s("The namespace prefix."),
        attribute: b("Writes the property as an attribute instead of an element."),
        wrapped: b("Wraps array items in an extra element.")
      }
    },
    Example: {
      doc: "A named example value.",
      ref: true,
      fields: {
        summary: s("A short summary of the example."),
        description: s("A longer description of the example."),
        value: a("The example value inline."),
        dataValue: a("The example as data, before serialization.", { since: 32 }),
        serializedValue: s("The example exactly as sent on the wire.", { since: 32 }),
        externalValue: s("A URL to the example value.")
      }
    },
    Link: {
      doc: "A link from a response to another operation.",
      ref: true,
      fields: {
        operationRef: s("A URI reference to the linked operation."),
        operationId: s("The operationId of the linked operation."),
        parameters: a("Parameter values for the linked operation, keyed by name."),
        requestBody: a("The request body for the linked operation."),
        description: s("A description of the link."),
        server: o("Server", "A server that overrides the target operation servers.")
      }
    },
    Callback: {
      doc: "Requests the API may send back, keyed by a runtime URL expression.",
      ref: true,
      fields: {},
      patterns: [{ re: /^/, t: "obj", of: "PathItem", doc: "The request sent to the URL given by this expression." }]
    },
    SecurityRequirement: {
      doc: "The security schemes required, each mapped to its list of scopes.",
      fields: {},
      patterns: [{ re: /^/, t: "list", of: "str", doc: "The scopes required from this security scheme." }]
    },
    SecurityScheme: {
      doc: "A security scheme the operations can use.",
      ref: true,
      fields: {
        type: s("The kind of security scheme.", { req: true, enum: ["apiKey", "http", "oauth2", "openIdConnect", ["mutualTLS", 31]] }),
        description: s("A description of the security scheme."),
        name: s("The name of the header, query or cookie parameter for apiKey."),
        in: s("Where the API key is sent.", { enum: ["query", "header", "cookie"] }),
        scheme: s("The HTTP authorization scheme, such as bearer.", { hints: ["basic", "bearer", "digest"] }),
        bearerFormat: s("A hint about the bearer token format, such as JWT."),
        flows: o("OAuthFlows", "The OAuth flows the scheme supports."),
        openIdConnectUrl: s("The OpenID Connect discovery URL."),
        oauth2MetadataUrl: s("The OAuth 2.0 authorization server metadata URL.", { since: 32 }),
        deprecated: b("Marks the security scheme as deprecated.", { since: 32 })
      }
    },
    OAuthFlows: {
      doc: "The OAuth flows a scheme supports.",
      fields: {
        implicit: o("OAuthFlow", "The implicit flow."),
        password: o("OAuthFlow", "The resource owner password flow."),
        clientCredentials: o("OAuthFlow", "The client credentials flow."),
        authorizationCode: o("OAuthFlow", "The authorization code flow."),
        deviceAuthorization: o("OAuthFlow", "The device authorization flow.", { since: 32 })
      }
    },
    OAuthFlow: {
      doc: "The settings of one OAuth flow.",
      fields: {
        authorizationUrl: s("The authorization endpoint URL."),
        deviceAuthorizationUrl: s("The device authorization endpoint URL.", { since: 32 }),
        tokenUrl: s("The token endpoint URL."),
        refreshUrl: s("The URL for refreshing tokens."),
        scopes: m("str", "The available scopes, each mapped to a short description.", { req: true })
      }
    },
    Tag: {
      doc: "Metadata for a tag used by operations.",
      fields: {
        name: s("The tag name.", { req: true }),
        summary: s("A short summary of the tag.", { since: 32 }),
        description: s("A description of the tag."),
        externalDocs: o("ExternalDocs", "A link to additional documentation for this tag."),
        parent: s("The name of the tag this one is nested under.", { since: 32 }),
        kind: s("The category of the tag, such as nav or badge.", { since: 32, hints: ["nav", "badge", "audience"] })
      }
    },
    ExternalDocs: {
      doc: "A link to external documentation.",
      fields: {
        description: s("A description of the linked documentation."),
        url: s("The URL of the documentation.", { req: true })
      }
    }
  };
  var REF = s("A reference to an object defined elsewhere.");
  var EXT = a("Specification extension: a custom field that tools may use.");
  function verOf(text) {
    const mm = /(?:^['"]?|")openapi['"]?\s*:\s*['"]?3\.(\d+)/m.exec(text);
    return mm ? 30 + Number(mm[1]) : void 0;
  }
  var active = (f, ver) => (!f.since || ver >= f.since) && (!f.until || ver < f.until);
  var kindsOf = (f, ver) => (f.tFrom && ver >= f.tFrom[0] ? f.tFrom[1] : f.t).split("|");
  var enumOf = (f, ver) => f.enum?.filter((e) => !Array.isArray(e) || active({ since: e[1], until: e[2] }, ver)).map((e) => Array.isArray(e) ? e[0] : e);
  function member(type, key, ver) {
    const obj = OBJECTS[type];
    if (!obj) return void 0;
    if (Object.hasOwn(obj.fields, key)) {
      const f = obj.fields[key];
      return active(f, ver) ? { spec: f, via: "field" } : { spec: f, via: "field", gated: true };
    }
    if (key === "$ref" && obj.ref) return { spec: REF, via: "field" };
    if (key.startsWith("x-")) return { spec: EXT, via: "pattern" };
    const p = obj.patterns?.find((p2) => p2.re.test(key));
    return p ? { spec: p, via: "pattern" } : void 0;
  }
  var itemSpec = (f) => OBJECTS[f.of] ? { t: "obj", of: f.of, doc: OBJECTS[f.of].doc } : { t: f.of ?? "any", doc: f.doc, enum: f.enum };
  var nodeOf = (spec, ver) => {
    const kinds = kindsOf(spec, ver);
    const kind = kinds.find((k) => k === "obj" || k === "map" || k === "list");
    return kind ? { kind, type: spec.of, spec } : { kind: "prim", type: kinds[0], spec };
  };
  function typeAt(path, ver) {
    let cur = { kind: "obj", type: "OpenAPI", spec: null };
    for (const seg of path) {
      if (cur.kind === "obj") {
        const mm = member(cur.type, String(seg), ver);
        if (!mm) return null;
        cur = nodeOf(mm.spec, ver);
      } else if (cur.kind === "map" || cur.kind === "list" && typeof seg === "number") {
        cur = nodeOf(itemSpec(cur.spec), ver);
      } else return null;
    }
    return cur;
  }

  // src/oas/ast.js
  var isJson = (text) => /^\s*[{[]/.test(text);
  function parse3(text) {
    const lc = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lc });
    return { doc, lc, ver: verOf(text), json: isJson(text), root: doc.contents };
  }
  function range(lc, [s2, e]) {
    const a2 = lc.linePos(s2);
    const b2 = lc.linePos(e);
    return { startLine: a2.line, startCol: a2.col, endLine: b2.line, endCol: b2.col };
  }
  var head = (text, [s2, e]) => {
    const eol = text.indexOf("\n", s2);
    return [s2, eol < 0 ? e : Math.min(e, eol)];
  };
  var keyOf = (pair2) => isScalar(pair2.key) && pair2.key.value != null ? String(pair2.key.value) : null;
  var pairOf = (map2, key) => isMap(map2) ? map2.items.find((p) => keyOf(p) === key) : void 0;
  function formatJson(text) {
    const big = text.replace(/"(?:[^"\\]|\\.)*"/g, '""').match(/(?<![\d.])-?\d+(?![\d.eE])/g)?.find((n2) => !Number.isSafeInteger(Number(n2)));
    if (big) throw new Error(`Not formatted: ${big} is too large for a JavaScript number and would change`);
    return JSON.stringify(JSON.parse(text), null, 2) + "\n";
  }

  // src/oas/context.js
  var KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#{[\]][^#]*?)\s*:(?=\s|$)/;
  var BLOCK = /(?::\s*|(?:^|\s)-\s+)[|>][-+0-9]*\s*(?:#.*)?$/;
  function unq(k) {
    if (k[0] === "'") return k.slice(1, -1).replace(/''/g, "'");
    if (k[0] === '"') {
      try {
        return JSON.parse(k);
      } catch {
        return k.slice(1, -1);
      }
    }
    return k.trimEnd();
  }
  function scan(lines) {
    const out = [];
    let block = -1;
    for (const raw of lines) {
      const ind = raw.search(/\S/);
      if (block >= 0 && (ind < 0 || ind > block)) {
        out.push(ind < 0 ? null : false);
        continue;
      }
      block = -1;
      if (ind < 0 || raw[ind] === "#") {
        out.push(null);
        continue;
      }
      const d = /^( *)(-(?: +|$))?/.exec(raw);
      const dash = d[2] ? d[1].length : -1;
      const rest = raw.slice(d[0].length);
      const kc = dash >= 0 && !rest ? dash + 2 : d[0].length;
      const k = KEY.exec(rest);
      const key = k ? unq(k[1]) : null;
      out.push({ dash, kc, key, hasVal: k ? /^\s*[^\s#]/.test(rest.slice(k[0].length)) : rest !== "" });
      if (BLOCK.test(raw)) block = key != null ? kc : dash;
    }
    return out;
  }
  function itemIndex(info, j, d) {
    let n2 = 0;
    for (let i2 = j - 1; i2 >= 0; i2--) {
      const L = info[i2];
      if (!L) continue;
      const col = L.dash >= 0 ? L.dash : L.kc;
      if (col < d || col === d && L.dash < 0) break;
      if (L.dash === d) n2++;
    }
    return n2;
  }
  function parents(info, i0, c, dash) {
    const path = [];
    let allowEq = false;
    if (dash >= 0) {
      path.push(itemIndex(info, i0, dash));
      c = dash;
      allowEq = true;
    }
    for (let j = i0 - 1; j >= 0 && (c > 0 || allowEq); j--) {
      const L = info[j];
      if (!L || L.kc > c) continue;
      const parent = L.kc < c || allowEq && L.key != null && !L.hasVal;
      if (parent) {
        if (L.key == null) continue;
        path.push(L.key);
      } else if (L.dash < 0) continue;
      if (L.dash >= 0) {
        path.push(itemIndex(info, j, L.dash));
        c = L.dash;
        allowEq = true;
      } else {
        c = L.kc;
        allowEq = false;
      }
    }
    return path.reverse();
  }
  function siblings(info, i0, c, dash) {
    const keys = /* @__PURE__ */ new Set();
    if (dash < 0) {
      for (let j = i0 - 1; j >= 0; j--) {
        const L = info[j];
        if (!L || L.kc > c) continue;
        if (L.kc < c) break;
        if (L.key != null) keys.add(L.key);
        if (L.dash >= 0) break;
      }
    }
    for (let j = i0 + 1; j < info.length; j++) {
      const L = info[j];
      if (!L || L.kc > c) continue;
      if (L.kc < c || L.dash >= 0) break;
      if (L.key != null) keys.add(L.key);
    }
    return keys;
  }
  function yamlCtx(text, line, col) {
    const lines = text.split(/\r?\n/);
    const info = scan(lines);
    const i0 = line - 1;
    const raw = lines[i0] ?? "";
    if (info[i0] === false) return null;
    const m2 = /^( *)(- +)?(.*)$/.exec(raw.slice(0, col - 1));
    const dash = m2[2] ? m2[1].length : -1;
    const c = m2[1].length + (m2[2]?.length ?? 0);
    const k = KEY.exec(m2[3]);
    const kv = k ? { position: "value", key: unq(k[1]), prefix: m2[3].slice(k[0].length).trimStart() } : { position: "key", key: info[i0]?.key ?? null, prefix: m2[3] };
    return { path: parents(info, i0, c, dash), keysPresent: siblings(info, i0, c, dash), ...kv, indent: c };
  }
  var JSON_TOKEN = /"(?:[^"\\\n]|\\.)*"?|[{}[\]:,]|[^\s{}[\]:,"]+/g;
  function jsonCtx(text, line, col) {
    let off = 0;
    for (let l2 = 1; l2 < line && off >= 0; l2++) off = text.indexOf("\n", off) + 1;
    off += col - 1;
    const stack = [{ kind: "arr", idx: 0, keys: /* @__PURE__ */ new Set(), expect: "value" }];
    let snap = null;
    const take = (top, prefix, inKey) => {
      const position = top.kind === "obj" && (inKey || top.expect !== "value") ? "key" : "value";
      snap = {
        path: stack.slice(2).map((f) => f.key),
        frame: top,
        position,
        key: position === "value" ? top.kind === "obj" ? top.pending : null : null,
        prefix
      };
    };
    JSON_TOKEN.lastIndex = 0;
    for (let mt; mt = JSON_TOKEN.exec(text); ) {
      const tok = mt[0];
      const s2 = mt.index;
      const e = s2 + tok.length;
      const top = stack[stack.length - 1];
      const open = tok[0] === '"' && (tok.length === 1 || tok[tok.length - 1] !== '"');
      let inside = false;
      if (!snap) {
        if (s2 >= off) take(top, "", false);
        else if (tok[0] === '"' && off < e + (open ? 1 : 0)) {
          inside = true;
          take(top, text.slice(s2, off), top.kind === "obj" && top.expect === "key");
          if (snap.position === "key") snap.key = unqJson(tok);
        } else if (!/^[{}[\]:,"]/.test(tok) && off <= e) {
          inside = true;
          take(top, text.slice(s2, off), top.kind === "obj" && top.expect === "key");
        }
      }
      if (tok === "{" || tok === "[") {
        stack.push({ kind: tok === "{" ? "obj" : "arr", key: top.kind === "obj" ? top.pending : top.idx, idx: 0, keys: /* @__PURE__ */ new Set(), expect: tok === "{" ? "key" : "value" });
        top.expect = "comma";
      } else if (tok === "}" || tok === "]") {
        if (stack.length > 1 && stack.pop() === snap?.frame) break;
      } else if (tok === ":") top.expect = "value";
      else if (tok === ",") {
        top.expect = top.kind === "obj" ? "key" : "value";
        if (top.kind === "arr") top.idx++;
      } else if (top.kind === "obj" && top.expect === "key") {
        top.pending = unqJson(tok);
        if (!inside) top.keys.add(top.pending);
        top.expect = "colon";
      } else top.expect = "comma";
    }
    if (!snap) take(stack[stack.length - 1], "", false);
    return { path: snap.path, keysPresent: snap.frame.keys, position: snap.position, key: snap.key, prefix: snap.prefix, indent: 0 };
  }
  function unqJson(tok) {
    try {
      return JSON.parse(tok);
    } catch {
      return tok.replace(/^"|"$/g, "");
    }
  }
  function contextAt(text, line, col) {
    const json = isJson(text);
    const ctx = json ? jsonCtx(text, line, col) : yamlCtx(text, line, col);
    if (!ctx) return null;
    const version = verOf(text) ?? 32;
    const t = typeAt(ctx.path, version);
    return { ...ctx, objectType: t?.kind === "obj" ? t.type : null, container: t && t.kind !== "obj" ? t : null, version, json };
  }

  // src/oas/complete.js
  var lower = (s2) => s2.toLowerCase();
  var strip = (p) => p.replace(/^["']/, "");
  function insertKey(key, spec, ctx, rest, pad) {
    if (ctx.json) return rest.includes(":") ? `"${key}"` : `"${key}": `;
    const k = /^\d/.test(key) ? `'${key}'` : key;
    if (rest.includes(":")) return k;
    const t = kindsOf(spec, ctx.version)[0];
    return t === "obj" || t === "map" ? `${k}:
${pad}  ` : t === "list" ? `${k}:
${pad}  - ` : `${k}: `;
  }
  function complete(text, line, col) {
    const ctx = contextAt(text, line, col);
    if (!ctx) return [];
    const raw = text.split(/\r?\n/)[line - 1] ?? "";
    const rest = raw.slice(col - 1);
    const pad = " ".repeat(Math.max(0, ctx.indent - raw.search(/\S|$/)));
    const pre = lower(strip(ctx.prefix));
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (label2, item2) => {
      if (seen.has(label2) || !lower(label2).startsWith(pre)) return;
      seen.add(label2);
      out.push({ label: label2, ...item2 });
    };
    const ver = ctx.version;
    if (ctx.position === "key") {
      const obj = OBJECTS[ctx.objectType];
      const keyItem = (key, spec, required) => {
        if (ctx.keysPresent.has(key)) return;
        add(key, { insertText: insertKey(key, spec, ctx, rest, pad), kind: "key", doc: spec.doc, ...required && { required: true }, sortText: (required ? "0" : "1") + key });
      };
      if (obj) {
        for (const [key, f2] of Object.entries(obj.fields)) {
          if (active(f2, ver)) keyItem(key, f2, f2.req && !(f2.reqUntil && ver >= f2.reqUntil));
        }
        for (const p of obj.patterns ?? []) for (const key of p.keyHints ?? []) keyItem(key, p);
      } else if (ctx.container?.kind === "map") {
        for (const key of ctx.container.spec.keyHints ?? []) keyItem(key, itemSpec(ctx.container.spec));
      }
      return out;
    }
    const f = ctx.objectType && ctx.key != null ? member(ctx.objectType, ctx.key, ver)?.spec : null;
    if (!f || f === EXT) return out;
    const values = enumOf(f, ver) ?? f.hints ?? (kindsOf(f, ver).includes("bool") ? ["true", "false"] : []);
    const isStr = kindsOf(f, ver).includes("str");
    for (const v2 of values) {
      const ins = ctx.json ? isStr ? `"${v2}"` : v2 : isStr && /^(null|true|false)$/.test(v2) ? `'${v2}'` : v2;
      add(v2, { insertText: (!ctx.json && raw[col - 2] === ":" ? " " : "") + ins, kind: "value", doc: f.doc, sortText: "1" + v2 });
    }
    return out;
  }
  var since = (v2) => `${Math.floor(v2 / 10)}.${v2 % 10}`;
  var PRIM = { str: "string", num: "number", int: "integer", bool: "boolean", any: "any" };
  var typeName = (t, of) => t === "obj" ? of : t === "map" ? `map of ${OBJECTS[of] ? of : PRIM[of]}` : t === "list" ? `list of ${OBJECTS[of] ? of : PRIM[of]}` : PRIM[t];
  function fieldDoc(text, line, col) {
    const raw = text.split(/\r?\n/)[line - 1] ?? "";
    const re = /^( *(?:- +)?)("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#{[\]][^#]*?)\s*:(?=\s|$)|"((?:[^"\\]|\\.)*)"\s*:/g;
    let hit = null;
    for (let mt; mt = re.exec(raw); ) {
      const start = mt.index + (mt[1]?.length ?? 0);
      const len = (mt[2] ?? `"${mt[3]}"`).length;
      if (col - 1 >= start && col - 1 <= start + len) hit = { start, quoted: mt[3] != null };
    }
    if (!hit) return null;
    const ctx = contextAt(text, line, hit.start + 1 + (hit.quoted ? 1 : 0));
    if (!ctx || ctx.position !== "key" || ctx.key == null) return null;
    const key = ctx.key;
    const ver = ctx.version;
    if (key.startsWith("x-")) return { title: key, doc: EXT.doc, type: "any", required: false };
    if (ctx.container?.kind === "map") {
      const it = itemSpec(ctx.container.spec);
      return { title: key, doc: it.doc, type: typeName(it.t, it.of), required: false };
    }
    const mm = ctx.objectType && member(ctx.objectType, key, ver);
    if (!mm) return null;
    const f = mm.spec;
    const note = [f.since && `Since OpenAPI ${since(f.since)}.`, f.until && `Removed in OpenAPI ${since(f.until)}.`].filter(Boolean).join(" ");
    return {
      title: key,
      doc: note ? `${f.doc} ${note}` : f.doc,
      type: kindsOf(f, ver).map((t) => typeName(t, f.of)).join(" or "),
      required: !!f.req && !(f.reqUntil && ver >= f.reqUntil)
    };
  }

  // src/oas/validate.js
  var START = { startLine: 1, startCol: 1, endLine: 1, endCol: 2 };
  var mark = (severity, message, where) => ({ severity, message, ...where });
  var v = (n2) => `${Math.floor(n2 / 10)}.${n2 % 10}`;
  function syntaxRule({ doc, lc }) {
    const one = (severity) => (e) => mark(severity, e.message.split("\n")[0], range(lc, e.pos));
    return [...doc.errors.map(one("error")), ...doc.warnings.map(one("warning"))];
  }
  function versionRule({ doc, lc, root }) {
    if (doc.errors.length) return [];
    const sw = pairOf(root, "swagger");
    if (sw) return [mark("error", "Swagger 2.0 is not supported by the editor (OpenAPI 3.x only)", range(lc, sw.key.range))];
    const p = pairOf(root, "openapi");
    if (!p) return [mark("error", "Missing required 'openapi' field", START)];
    const val = isScalar(p.value) ? String(p.value.value) : "";
    const mm = /^3\.(\d+)\.\d+/.exec(val);
    if (mm && Number(mm[1]) <= 2) return [];
    const where = p.value?.range ? range(lc, p.value.range) : range(lc, p.key.range);
    if (mm) return [mark("error", `OpenAPI ${val} is newer than this editor supports (up to 3.2)`, where)];
    return [mark("error", `Invalid OpenAPI version '${val}'. Expected 3.0.x, 3.1.x or 3.2.x`, where)];
  }
  var NAMES2 = { str: "string", num: "number", int: "integer", bool: "boolean", map: "mapping", list: "list" };
  function structureRule({ doc, lc, ver, root, text }) {
    if (doc.errors.length || !ver || !isMap(root)) return [];
    const out = [];
    const at = (node) => range(lc, head(text, node.range));
    const object = (map2, type, owner) => {
      const obj = OBJECTS[type];
      const hasRef = obj.ref && pairOf(map2, "$ref") && !(type === "Schema" && ver >= 31);
      for (const pair2 of map2.items) {
        const key = keyOf(pair2);
        if (key == null || key.startsWith("x-") || key === "<<") continue;
        const mm = member(type, key, ver);
        if (!mm) {
          if (!hasRef) out.push(mark("warning", `Unknown key '${key}' in ${type}`, range(lc, pair2.key.range)));
          continue;
        }
        if (mm.gated) {
          const msg = mm.spec.until && ver >= mm.spec.until ? `'${key}' was removed in OpenAPI ${v(mm.spec.until)}` : `'${key}' needs OpenAPI ${v(mm.spec.since)}+`;
          out.push(mark("warning", msg, range(lc, pair2.key.range)));
          continue;
        }
        value(pair2.value, mm.spec, range(lc, pair2.key.range));
      }
      if (hasRef) return;
      for (const [key, f] of Object.entries(obj.fields)) {
        if (f.req && active(f, ver) && !(f.reqUntil && ver >= f.reqUntil) && !pairOf(map2, key)) {
          out.push(mark("error", `Missing required '${key}' in ${type}`, owner));
        }
      }
    };
    const value = (node, spec, owner) => {
      if (!node || isAlias(node) || isScalar(node) && node.value === null) return;
      const kinds = kindsOf(spec, ver);
      if (kinds.includes("any")) return;
      if (isMap(node)) {
        if (kinds.includes("obj")) return object(node, spec.of, owner ?? at(node));
        if (kinds.includes("map")) return node.items.forEach((p) => value(p.value, itemSpec(spec), p.key && range(lc, p.key.range)));
      } else if (isSeq(node)) {
        if (kinds.includes("list")) return node.items.forEach((it) => value(it, itemSpec(spec)));
      } else if (isScalar(node)) {
        const x = node.value;
        const ok = typeof x === "string" ? kinds.includes("str") : typeof x === "number" ? kinds.includes("num") || kinds.includes("int") && Number.isInteger(x) : typeof x === "boolean" ? kinds.includes("bool") || ver >= 31 && spec.of === "Schema" : false;
        if (ok) return scalar2(node, spec);
        if (kinds.includes("str") && (typeof x === "number" || typeof x === "boolean")) return out.push(mark("warning", "Expected string; quote the value", at(node)));
      }
      const want = kinds.map((k) => k === "obj" ? `mapping (${spec.of})` : NAMES2[k]).join(" or ");
      const found = isMap(node) ? "mapping" : isSeq(node) ? "list" : NAMES2[{ string: "str", number: "num", boolean: "bool" }[typeof node.value]] ?? typeof node.value;
      out.push(mark("error", `Expected ${want}, found ${found}`, at(node)));
    };
    const scalar2 = (node, spec) => {
      const allowed = enumOf(spec, ver);
      const x = String(node.value);
      if (!allowed || allowed.includes(x)) return;
      const gated = spec.enum.find((e) => Array.isArray(e) && e[0] === x);
      if (gated) out.push(mark("warning", gated[2] && ver >= gated[2] ? `'${x}' was removed in OpenAPI ${v(gated[2])}` : `'${x}' needs OpenAPI ${v(gated[1])}+`, at(node)));
      else out.push(mark("error", `Invalid value '${x}'. Allowed: ${allowed.join(", ")}`, at(node)));
    };
    object(root, "OpenAPI", START);
    return out;
  }
  var rules = [syntaxRule, versionRule, structureRule];
  function validate(text) {
    const ctx = { ...parse3(text), text };
    return rules.flatMap((r) => r(ctx)).sort((a2, b2) => a2.startLine - b2.startLine || a2.startCol - b2.startCol);
  }

  // src/oas/outline.js
  var METHODS2 = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"];
  function outline(text) {
    const { root, lc } = parse3(text);
    if (!isMap(root)) return [];
    const line = (node2) => lc.linePos(node2.range[0]).line;
    const str = (map2, key) => {
      const v2 = pairOf(map2, key)?.value;
      return isScalar(v2) && v2.value != null ? String(v2.value) : void 0;
    };
    const node = (label2, kind, at, extra) => ({ label: label2, kind, line: line(at), ...extra, children: extra?.children ?? [] });
    const pairs2 = (map2) => isMap(map2) ? map2.items.filter((p) => keyOf(p) != null) : [];
    const op2 = (p) => node(keyOf(p).toUpperCase(), "operation", p.key, { method: keyOf(p).toLowerCase(), ...str(p.value, "summary") && { detail: str(p.value, "summary") } });
    const ops = (item2) => [
      ...pairs2(item2).filter((p) => METHODS2.includes(keyOf(p))).map(op2),
      ...pairs2(pairOf(item2, "additionalOperations")?.value).map(op2)
    ];
    const out = [];
    for (const p of root.items) {
      const key = keyOf(p);
      const val = p.value;
      if (key === "info") {
        const detail = [str(val, "title"), str(val, "version")].filter(Boolean).join(" ");
        out.push(node("Info", "info", p.key, detail ? { detail } : void 0));
      } else if (key === "servers" && isSeq(val)) {
        out.push(node("Servers", "servers", p.key, { children: val.items.filter(isMap).map((s2) => node(str(s2, "url") ?? "(no url)", "server", s2)) }));
      } else if (key === "paths" || key === "webhooks") {
        out.push(node(key === "paths" ? "Paths" : "Webhooks", key, p.key, { children: pairs2(val).map((q) => node(keyOf(q), "path", q.key, { children: ops(q.value) })) }));
      } else if (key === "components") {
        out.push(node("Components", "components", p.key, { children: pairs2(val).map((g) => node(keyOf(g), "group", g.key, { children: pairs2(g.value).map((c) => node(keyOf(c), "component", c.key)) })) }));
      } else if (key === "tags" && isSeq(val)) {
        out.push(node("Tags", "tags", p.key, { children: val.items.filter(isMap).map((t) => node(str(t, "name") ?? "(no name)", "tag", t)) }));
      }
    }
    return out;
  }

  // src/oas/templates.js
  function starter(ver) {
    const minor = Number(ver.split(".")[1]);
    const lines = [
      `openapi: ${ver}`,
      minor >= 2 && "$self: https://api.example.com/openapi.yaml",
      "info:",
      "  title: Example API",
      minor >= 1 && "  summary: A starter API with one endpoint",
      "  version: 1.0.0",
      "servers:",
      "  - url: https://api.example.com/v1",
      "paths:",
      "  /items:",
      "    get:",
      "      summary: List items",
      "      operationId: listItems",
      "      responses:",
      "        '200':",
      "          description: The items",
      "          content:",
      "            application/json:",
      "              schema:",
      "                type: array",
      "                items:",
      "                  $ref: '#/components/schemas/Item'",
      "components:",
      "  schemas:",
      "    Item:",
      "      type: object",
      "      required: [id]",
      "      properties:",
      "        id:",
      "          type: string",
      "        note:",
      ...minor >= 1 ? ["          type: [string, 'null']"] : ["          type: string", "          nullable: true"]
    ];
    return lines.filter((l2) => l2 !== false).join("\n") + "\n";
  }

  // src/editor.js
  var store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v2) {
      try {
        localStorage.setItem(k, v2);
      } catch {
      }
    }
  };
  var md = (s2) => s2.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, "\\$&");
  var specOf = (text) => text.match(/^\s*["']?openapi["']?\s*:\s*["']?([\w.-]+)/m)?.[1];
  function initEditor({ $: $2, el: el2 }) {
    let draft = null;
    try {
      draft = JSON.parse(store.get("sc.draft"));
    } catch {
    }
    if (typeof draft?.text !== "string") draft = null;
    let file = draft?.name ?? null;
    let saved = draft ? null : starter(TEMPLATES.at(-1));
    const model = monaco.editor.createModel(draft?.text ?? saved, "yaml", monaco.Uri.parse("inmemory://edit/spec.yaml"));
    const editor = monaco.editor.create($2("edit-editor"), {
      model,
      theme: "swagger-compare",
      automaticLayout: true,
      minimap: { enabled: false },
      quickSuggestions: { other: true, strings: true, comments: false },
      wordBasedSuggestions: "off",
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 20,
      fontLigatures: false,
      scrollBeyondLastLine: false,
      padding: { top: 10 },
      renderLineHighlight: "line",
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });
    const setMode = (m2) => {
      document.body.classList.toggle("edit", m2 === "edit");
      $2("edit").hidden = m2 !== "edit";
      document.querySelectorAll("[data-mode]").forEach((b2) => b2.setAttribute("aria-pressed", String(b2.dataset.mode === m2)));
      store.set("sc.mode", m2);
      if (m2 === "edit") editor.layout();
    };
    document.querySelectorAll("[data-mode]").forEach((b2) => b2.addEventListener("click", () => setMode(b2.dataset.mode)));
    const KIND = { key: "Property", value: "Value", snippet: "Snippet" };
    monaco.languages.registerCompletionItemProvider("yaml", {
      triggerCharacters: [" ", ":", "\n", "-"],
      provideCompletionItems(m2, pos) {
        if (m2 !== model) return;
        const text = m2.getValue();
        const ctx = contextAt(text, pos.lineNumber, pos.column);
        if (!ctx) return;
        const pre = ctx.prefix;
        const closing = /^["']/.test(pre) && m2.getLineContent(pos.lineNumber)[pos.column - 1] === pre[0];
        const range2 = new monaco.Range(pos.lineNumber, pos.column - pre.length, pos.lineNumber, pos.column + (closing ? 1 : 0));
        const q = /^["']/.test(pre) ? pre[0] : "";
        return {
          suggestions: complete(text, pos.lineNumber, pos.column).map((c) => ({
            label: c.label,
            insertText: c.insertText,
            filterText: q + c.label,
            kind: monaco.languages.CompletionItemKind[KIND[c.kind]],
            detail: c.required ? "required" : void 0,
            documentation: c.doc,
            sortText: c.sortText,
            range: range2,
            .../\n[ -]*$/.test(c.insertText) && { command: { id: "editor.action.triggerSuggest", title: "Suggest" } }
          }))
        };
      }
    });
    monaco.languages.registerHoverProvider("yaml", {
      provideHover(m2, pos) {
        if (m2 !== model) return;
        const d = fieldDoc(m2.getValue(), pos.lineNumber, pos.column);
        if (!d) return;
        return { contents: [{ value: `**${md(d.title)}** \xB7 ${d.type}${d.required ? " \xB7 required" : ""}` }, { value: md(d.doc) }] };
      }
    });
    const tabs = document.querySelectorAll("[data-tab]");
    const showTab = (name) => tabs.forEach((t) => {
      t.setAttribute("aria-selected", String(t.dataset.tab === name));
      $2(`tab-${t.dataset.tab}`).hidden = t.dataset.tab !== name;
    });
    tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
    const reveal = (line, col = 1) => {
      editor.setPosition({ lineNumber: line, column: col });
      editor.revealPositionInCenter({ lineNumber: line, column: col });
      editor.focus();
    };
    let markers = [];
    const renderProblems = () => {
      const ul = $2("problems");
      ul.replaceChildren(
        ...markers.map((p) => {
          const b2 = el2("button");
          b2.type = "button";
          b2.append(el2("span", `dot ${p.severity}`), el2("span", null, p.message), el2("span", "ln", `Ln ${p.startLine}`));
          b2.addEventListener("click", () => reveal(p.startLine, p.startCol));
          const li = el2("li");
          li.append(b2);
          return li;
        })
      );
      if (!markers.length) ul.append(el2("li", "none", "No problems"));
      const n2 = $2("n-problems");
      n2.textContent = markers.length;
      n2.classList.toggle("bad", markers.some((p) => p.severity === "error"));
    };
    let nodes = [];
    const renderOutline = () => {
      nodes = [];
      const list = (items, depth) => {
        const ul = el2("ul", "tree");
        for (const it of items) {
          const b2 = el2("button");
          b2.type = "button";
          b2.dataset.depth = depth;
          b2.append(it.method ? el2("span", `method m-${it.method}`, it.label) : el2("span", null, it.label));
          if (it.detail) b2.append(el2("span", "sub", it.detail));
          b2.addEventListener("click", () => reveal(it.line));
          nodes.push({ line: it.line, btn: b2 });
          const li = el2("li");
          li.append(b2);
          if (it.children.length) li.append(list(it.children, depth + 1));
          ul.append(li);
        }
        return ul;
      };
      $2("outline").replaceChildren(...list(outline(model.getValue()), 0).children);
      markCurrent();
    };
    let cur = null;
    const markCurrent = () => {
      const line = editor.getPosition()?.lineNumber ?? 1;
      const hit = nodes.findLast((n2) => n2.line <= line)?.btn ?? null;
      if (hit === cur) return;
      cur?.classList.remove("cur");
      cur = hit;
      if (cur) {
        cur.classList.add("cur");
        cur.scrollIntoView({ block: "nearest" });
      }
    };
    editor.onDidChangeCursorPosition(markCurrent);
    const head2 = () => {
      $2("ed-file").textContent = file ?? "Untitled";
      const v2 = specOf(model.getValue());
      $2("ed-spec").textContent = v2 ? `OpenAPI ${v2}` : "";
      $2("ed-spec").hidden = !v2;
    };
    const check = () => {
      markers = validate(model.getValue());
      const sev = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning };
      monaco.editor.setModelMarkers(
        model,
        "oas",
        markers.map((p) => ({ severity: sev[p.severity], message: p.message, startLineNumber: p.startLine, startColumn: p.startCol, endLineNumber: p.endLine, endColumn: p.endCol }))
      );
      renderProblems();
      renderOutline();
    };
    let checkTimer, draftTimer;
    const saveDraft = () => store.set("sc.draft", JSON.stringify({ text: model.getValue(), name: file }));
    model.onDidChangeContent(() => {
      head2();
      clearTimeout(checkTimer);
      checkTimer = setTimeout(check, 300);
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 500);
    });
    const replace = (text) => {
      editor.pushUndoStop();
      editor.executeEdits("load", [{ range: model.getFullModelRange(), text }]);
      editor.pushUndoStop();
    };
    const load = (text, name) => {
      file = name;
      saved = text;
      replace(text);
      head2();
      saveDraft();
    };
    const ver = $2("new-ver");
    ver.append(...TEMPLATES.map((v2) => el2("option", null, v2)));
    ver.value = TEMPLATES.at(-1);
    const discardOk = () => model.getValue() === saved || confirm("Replace the unsaved text?");
    $2("ed-new").addEventListener("click", () => {
      if (discardOk()) load(starter(ver.value), null);
    });
    const input = $2("edit-input");
    $2("ed-open").addEventListener("click", () => {
      input.value = "";
      input.click();
    });
    input.addEventListener("change", async () => {
      const f = input.files[0];
      if (f) {
        const text = await f.text();
        if (discardOk()) load(text, f.name);
      }
    });
    const node = $2("edit-editor");
    const drop = el2("div", "drop", "Drop to open");
    node.append(drop);
    let dropTimer;
    node.addEventListener(
      "dragover",
      (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        drop.classList.add("on");
        clearTimeout(dropTimer);
        dropTimer = setTimeout(() => drop.classList.remove("on"), 120);
      },
      true
    );
    node.addEventListener(
      "drop",
      async (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove("on");
        const f = e.dataTransfer.files[0];
        if (f) {
          const text = await f.text();
          if (discardOk()) load(text, f.name);
        }
      },
      true
    );
    $2("ed-save").addEventListener("click", () => {
      const text = model.getValue();
      const a2 = el2("a");
      a2.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a2.download = file ?? (isJson(text) ? "openapi.json" : "openapi.yaml");
      a2.click();
      setTimeout(() => URL.revokeObjectURL(a2.href), 1e3);
      saved = text;
    });
    $2("ed-format").addEventListener("click", () => {
      const text = model.getValue();
      let out, why;
      try {
        if (isJson(text)) out = formatJson(text);
        else {
          const doc = parseDocument(text);
          if (!doc.errors.length) out = doc.toString({ indent: 2, lineWidth: 0 });
        }
      } catch (e) {
        why = e.message;
      }
      if (out == null) {
        check();
        if (why) {
          markers.unshift({ severity: "error", message: why, startLine: 1, startCol: 1 });
          renderProblems();
        }
        showTab("problems");
        return;
      }
      if (out !== text) replace(out);
    });
    head2();
    check();
    if (store.get("sc.mode") === "edit") setMode("edit");
  }

  // src/renderer.js
  var base = new URL("../vendor/monaco/", location.href).href;
  self.MonacoEnvironment = {
    getWorkerUrl: () => {
      if (location.protocol === "file:") throw new Error("no workers under file://");
      return URL.createObjectURL(
        new Blob([`self.MonacoEnvironment={baseUrl:'${base}'};importScripts('${base}vs/base/worker/workerMain.js');`], {
          type: "text/javascript"
        })
      );
    }
  };
  window.require.config({ paths: { vs: base + "vs" } });
  window.require(["vs/editor/editor.main"], init);
  var $ = (id) => document.getElementById(id);
  var el = (tag, cls, text) => {
    const n2 = document.createElement(tag);
    if (cls) n2.className = cls;
    if (text != null) n2.textContent = text;
    return n2;
  };
  var GLYPH = { added: "+", removed: "\u2212", changed: "~" };
  var SIDE = { left: "Original", right: "Modified" };
  var ROUTE = /\b(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE) (\/\S*)/;
  function specLabel(text) {
    const m2 = text.match(/^\s*["']?(swagger|openapi)["']?\s*:\s*["']?([\w.-]+)/m);
    return m2 ? `${m2[1] === "swagger" ? "Swagger" : "OpenAPI"} ${m2[2]}` : text.trim() ? "Not a spec?" : "";
  }
  function richText(text, cls = "text") {
    const span = el("span", cls);
    const m2 = text.match(ROUTE);
    if (!m2) return span.textContent = text, span;
    span.append(
      text.slice(0, m2.index),
      el("span", `method m-${m2[1].toLowerCase()}`, m2[1]),
      el("span", "route", m2[2]),
      text.slice(m2.index + m2[0].length)
    );
    return span;
  }
  function defineTheme() {
    monaco.editor.defineTheme("swagger-compare", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "type", foreground: "8db4ff" },
        { token: "string", foreground: "c3d0e6" },
        { token: "number", foreground: "f2b84b" },
        { token: "keyword", foreground: "c792ea" },
        { token: "comment", foreground: "5d6a84", fontStyle: "italic" }
      ],
      colors: {
        "editor.background": "#151e31",
        "editor.foreground": "#e4e9f2",
        "editorLineNumber.foreground": "#3e4a66",
        "editorLineNumber.activeForeground": "#8a96ae",
        "editor.lineHighlightBackground": "#1b264080",
        "editor.lineHighlightBorder": "#00000000",
        "editor.selectionBackground": "#8db4ff33",
        "editorCursor.foreground": "#8db4ff",
        "editorIndentGuide.background1": "#25304a",
        "editorGutter.background": "#151e31",
        "diffEditor.insertedLineBackground": "#3ecf8e14",
        "diffEditor.insertedTextBackground": "#3ecf8e33",
        "diffEditor.removedLineBackground": "#ff6b7a14",
        "diffEditor.removedTextBackground": "#ff6b7a38",
        "diffEditorGutter.insertedLineBackground": "#3ecf8e22",
        "diffEditorGutter.removedLineBackground": "#ff6b7a22",
        "diffEditor.diagonalFill": "#25304a80",
        "diffEditor.border": "#25304a",
        "scrollbarSlider.background": "#25304a99",
        "scrollbarSlider.hoverBackground": "#334064",
        "editorOverviewRuler.border": "#00000000",
        "editorWidget.background": "#1b2640",
        "editorWidget.border": "#25304a",
        focusBorder: "#00000000"
      }
    });
  }
  function init() {
    defineTheme();
    const diff = monaco.editor.createDiffEditor($("editor"), {
      theme: "swagger-compare",
      originalEditable: true,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: false,
      // jump-to-left needs the original editor visible
      enableSplitViewResizing: false,
      // keeps panes aligned with their headers
      renderMarginRevertIcon: false,
      renderGutterMenu: false,
      automaticLayout: true,
      ignoreTrimWhitespace: false,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 20,
      fontLigatures: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderOverviewRuler: false,
      padding: { top: 10 },
      renderLineHighlight: "line",
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });
    document.fonts.ready.then(() => monaco.editor.remeasureFonts());
    const models = { left: monaco.editor.createModel("", "yaml"), right: monaco.editor.createModel("", "yaml") };
    diff.setModel({ original: models.left, modified: models.right });
    const editors = { left: diff.getOriginalEditor(), right: diff.getModifiedEditor() };
    const files = { left: null, right: null };
    const list = $("list");
    const state = $("state");
    let result = null;
    let liveTimer;
    let hidden = /* @__PURE__ */ new Set();
    const open = /* @__PURE__ */ new Set();
    const tagsOn = /* @__PURE__ */ new Set();
    let breakOnly = false;
    let view = "objects";
    const meta = { left: null, right: null };
    let rows = [];
    let groups = [];
    const renderMeta = () => {
      for (const side of ["left", "right"]) {
        const m2 = meta[side];
        const t = $(`title-${side}`);
        t.textContent = [m2?.title, m2?.version && `v${m2.version.replace(/^v/i, "")}`].filter(Boolean).join(" \xB7 ");
        t.title = t.textContent;
        t.hidden = !t.textContent;
      }
      const v2 = $("versions");
      v2.textContent = v2.title = heading(meta);
      v2.hidden = !v2.textContent;
    };
    const refreshHead = (side) => {
      const text = models[side].getValue();
      $(`file-${side}`).textContent = files[side] ?? (text.trim() ? "Pasted text" : "Empty");
      const spec = $(`spec-${side}`);
      spec.textContent = specLabel(text);
      spec.hidden = !spec.textContent;
      spec.classList.toggle("bad", spec.textContent === "Not a spec?");
    };
    const load = (side, text, name, m2 = null) => {
      files[side] = name;
      meta[side] = m2;
      renderMeta();
      const ed = editors[side];
      ed.pushUndoStop();
      ed.executeEdits("load", [{ range: models[side].getFullModelRange(), text }]);
      ed.pushUndoStop();
      refreshHead(side);
    };
    for (const side of ["left", "right"]) {
      const node = editors[side].getContainerDomNode();
      const hint = el("div", "hint");
      hint.append(el("b", null, side === "left" ? "Paste the original spec" : "Paste the modified spec"), el("span", null, "or drop a YAML or JSON file here"));
      const drop = el("div", "drop", `Drop to load as ${SIDE[side].toLowerCase()}`);
      node.append(hint, drop);
      let dropTimer;
      node.addEventListener(
        "dragover",
        (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          drop.classList.add("on");
          clearTimeout(dropTimer);
          dropTimer = setTimeout(() => drop.classList.remove("on"), 120);
        },
        true
      );
      node.addEventListener(
        "drop",
        async (e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove("on");
          const file = e.dataTransfer.files[0];
          if (file) load(side, await file.text(), file.name);
        },
        true
      );
      models[side].onDidChangeContent(() => {
        hint.hidden = models[side].getValueLength() > 0;
        if (!models[side].getValueLength()) files[side] = null;
        refreshHead(side);
        clearTimeout(liveTimer);
        liveTimer = setTimeout(run, 300);
      });
    }
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => e.preventDefault());
    const input = $("file-input");
    let openSide = "left";
    document.querySelectorAll("[data-open]").forEach(
      (b2) => b2.addEventListener("click", () => {
        openSide = b2.dataset.open;
        input.value = "";
        input.click();
      })
    );
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (file) load(openSide, await file.text(), file.name);
    });
    document.querySelectorAll("[data-clear]").forEach((b2) => b2.addEventListener("click", () => load(b2.dataset.clear, "", null)));
    $("swap").addEventListener("click", () => {
      const [l2, r] = [models.left.getValue(), models.right.getValue()];
      const [fl, fr] = [files.left, files.right];
      const [ml, mr] = [meta.left, meta.right];
      load("left", r, fr, mr);
      load("right", l2, fl, ml);
    });
    const hl = { left: editors.left.createDecorationsCollection(), right: editors.right.createDecorationsCollection() };
    const flash = { left: editors.left.createDecorationsCollection(), right: editors.right.createDecorationsCollection() };
    let flashTimer;
    const clearFlash = () => {
      clearTimeout(flashTimer);
      flash.left.clear();
      flash.right.clear();
    };
    const clearHl = () => {
      hl.left.clear();
      hl.right.clear();
      clearFlash();
    };
    const showHl = (c, reveal) => {
      clearFlash();
      for (const side of ["left", "right"]) {
        const r = c[side];
        const ed = editors[side];
        const options = r.exact ? { isWholeLine: true, className: "hl", linesDecorationsClassName: "hl-bar" } : { isWholeLine: true, className: "hl-anchor" };
        hl[side].set([{ range: new monaco.Range(r.start, 1, r.end, 1), options }]);
        const k = c.flash[side];
        if (reveal && k) flash[side].set([{ range: new monaco.Range(k.line, k.from, k.line, k.to), options: { inlineClassName: "name-flash" } }]);
        if (!reveal || side !== c.side) continue;
        const rows2 = Math.floor(ed.getLayoutInfo().height / ed.getOption(monaco.editor.EditorOption.lineHeight));
        if (r.end - r.start + 1 > rows2) ed.revealLineNearTop(r.start);
        else ed.revealLinesInCenterIfOutsideViewport(r.start, r.end);
      }
      if (reveal) flashTimer = setTimeout(clearFlash, 1600);
    };
    const jump = (side, line) => {
      const ed = editors[side];
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      ed.focus();
    };
    const showState = (kind, title, text, action) => {
      state.className = `state ${kind}`;
      state.hidden = false;
      const icon = {
        idle: '<path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2M12 8v8M8 12h8"/>',
        ok: '<path d="M5 12.5 10 17l9-10"/>',
        err: '<path d="M12 8v5M12 16.5v.01"/><path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/>'
      }[kind];
      state.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
      state.append(el("p", "state-title", title));
      const p = el("p", "state-text");
      p.append(...text);
      state.append(p);
      if (action) {
        const b2 = el("button", "show-line", action.label);
        b2.addEventListener("click", action.run);
        state.append(b2);
      }
    };
    const filtering = () => !!(hidden.size || tagsOn.size || breakOnly || $("search").value.trim());
    const renderHead = (g, vis) => {
      const n2 = { added: 0, removed: 0, changed: 0 };
      const tags = [];
      for (const r of vis) {
        n2[r.c.kind]++;
        if (!tags.includes(r.c.tag)) tags.push(r.c.tag);
      }
      const mini = el("span", "gmini");
      for (const k in n2) if (n2[k]) mini.append(el("span", k, GLYPH[k] + n2[k]));
      const said = Object.keys(n2).filter((k) => n2[k]).map((k) => `${n2[k]} ${k}`);
      const nb = vis.filter((r) => r.c.breaking).length;
      if (nb) said.push(`${nb} breaking`);
      g.head.setAttribute("aria-label", `${g.where}, ${vis.length} change${vis.length === 1 ? "" : "s"}: ${said.join(", ")}`);
      g.head.replaceChildren(el("span", "chev"), richText(g.where, "gwhere"), el("span", "gcount", vis.length), mini, el("span", "gtags", tags.join(" \xB7 ")));
    };
    const applyFilters = () => {
      const q = $("search").value.trim().toLowerCase();
      $("list-none")?.remove();
      for (const r of rows) {
        r.show = !hidden.has(r.c.kind) && (!tagsOn.size || tagsOn.has(r.c.tag)) && (!breakOnly || r.c.breaking) && (!q || r.li._haystack.includes(q));
        r.li.hidden = !r.show;
      }
      const filtered = filtering();
      for (const g of groups) {
        const vis = g.rows.filter((r) => r.show);
        renderHead(g, vis);
        g.li.hidden = !vis.length;
        const isOpen = filtered || open.has(g.where);
        g.ol.hidden = !isOpen;
        g.head.setAttribute("aria-expanded", String(isOpen));
      }
      const all = groups.length > 0 && groups.every((g) => !open.has(g.where));
      const ta = $("toggle-all");
      ta.title = all ? "Expand all" : "Collapse all";
      ta.setAttribute("aria-label", ta.title);
      ta.dataset.collapsed = String(all);
      ta.disabled = filtered;
      if (result?.changes.length && !rows.some((r) => r.show)) {
        const none = el("li", "none", "No changes match the filter.");
        none.id = "list-none";
        list.append(none);
      }
      updatePos();
    };
    const updatePos = () => {
      const vis = rows.filter((r) => r.show);
      const i2 = vis.findIndex((r) => r.btn === selected);
      $("pos").textContent = `${i2 < 0 ? "\u2013" : i2 + 1} / ${vis.length}`;
      $("prev").disabled = $("next").disabled = !vis.length;
    };
    const toggleGroup = (g) => {
      if (!filtering()) open[open.has(g.where) ? "delete" : "add"](g.where);
      applyFilters();
      const first = g.rows.find((r) => r.show);
      if (!g.ol.hidden && first) select(first.btn, false);
    };
    const nav = (dir) => {
      const vis = rows.filter((r) => r.show);
      if (!vis.length) return;
      const i2 = vis.findIndex((r) => r.btn === selected);
      const t = i2 < 0 ? vis[dir > 0 ? 0 : vis.length - 1] : vis[(i2 + dir + vis.length) % vis.length];
      open.add(t.g.where);
      applyFilters();
      select(t.btn, false);
    };
    const keyOf2 = (c) => `${c.kind}|${c.where}|${c.text}|${c.path.join("/")}`;
    let selected = null;
    let selKey = null;
    const expanded = /* @__PURE__ */ new Set();
    let lastScroll = 0;
    function run(openSelected = false) {
      clearHl();
      clearTimeout(liveTimer);
      if (result) lastScroll = list.scrollTop;
      selected = null;
      list.replaceChildren();
      rows = [];
      groups = [];
      result = null;
      $("filters").hidden = $("search-wrap").hidden = $("nav").hidden = $("tagbar").hidden = $("toolbar").hidden = $("summary").hidden = true;
      $("total").textContent = "";
      const [l2, r] = [models.left.getValue(), models.right.getValue()];
      const res = l2.trim() || r.trim() ? compare(l2, r) : null;
      for (const [side, text] of [["left", l2], ["right", r]]) {
        if (!text.trim()) meta[side] = null;
        else if (res.meta[side]) meta[side] = res.meta[side];
      }
      renderMeta();
      if (!l2.trim() || !r.trim()) {
        const missing = !l2.trim() && !r.trim() ? "both specs" : !l2.trim() ? "the original spec" : "the modified spec";
        showState("idle", "Two specs, one list of changes", [`Paste or drop ${missing}. Changes appear here as you type.`]);
        return;
      }
      if (res.error) {
        const { side, line, message } = res.error;
        showState("err", `The ${SIDE[side].toLowerCase()} spec can't be parsed`, [`Line ${line}: `, el("code", null, message.replace(/ at line \d+, column \d+:?$/, ""))], {
          label: "Show line",
          run: () => jump(side, line)
        });
        return;
      }
      if (!res.changes.length) {
        showState("ok", "No structural differences", ["Both specs describe the same API. Formatting and key order may still differ in the editor."]);
        return;
      }
      result = res;
      state.hidden = true;
      const counts2 = { added: 0, removed: 0, changed: 0 };
      for (const c of res.changes) counts2[c.kind]++;
      const index = new Map(res.changes.map((c, i2) => [c, i2]));
      const entries = view === "endpoints" ? byEndpoint(res.changes).flatMap((g) => g.rows.map((row) => ({ key: g.key, ...row }))) : res.changes.map((c) => ({ key: c.where, c, text: c.text }));
      const byKey = /* @__PURE__ */ new Map();
      entries.forEach(({ key, c, text }, n2) => {
        let g = byKey.get(key);
        if (!g) {
          g = { where: key, li: el("li", "group"), head: el("button", "ghead"), ol: el("ol", "gitems"), rows: [] };
          g.head.type = "button";
          g.ol.id = `grp-${groups.length}`;
          g.head.setAttribute("aria-controls", g.ol.id);
          g.head.addEventListener("click", () => toggleGroup(g));
          g.li.append(g.head, g.ol);
          byKey.set(key, g);
          groups.push(g);
          list.append(g.li);
        }
        const li = el("li");
        li._change = c;
        const hits = c.affects.flatMap((a2) => [a2.endpoint, a2.via ?? ""]);
        li._haystack = [c.tag, c.text, c.where, c.path.join(" "), ...c.details ?? [], c.breaking ? "breaking" : "", ...hits].join(" ").toLowerCase();
        const b2 = el("button", `item ${c.kind}${c.breaking ? " breaking" : ""}`);
        b2.title = `${c.path.join(" \u203A ")}
${SIDE[c.side]}, line ${c.line}${c.breaking ? "\nBreaking change" : ""}`;
        b2.dataset.i = index.get(c);
        const body = el("div");
        if (c.breaking) {
          const w = el("span", "warn", "\u26A0");
          w.setAttribute("role", "img");
          w.setAttribute("aria-label", "Breaking");
          body.append(w);
        }
        body.append(el("span", c.tag === "refactor" ? "tag tag-refactor" : "tag", c.tag), el("span", "text", text));
        b2.append(el("span", "glyph", GLYPH[c.kind]), body);
        b2.addEventListener("click", () => select(b2, true));
        li.append(b2);
        if (c.details) {
          const isOpen = expanded.has(keyOf2(c));
          const tog = el("button", "tog");
          tog.type = "button";
          tog.setAttribute("aria-expanded", String(isOpen));
          tog.setAttribute("aria-controls", `det-${n2}`);
          tog.append(el("span", "chev"), `Details (${c.details.length})`);
          const d = el("div", "details");
          d.id = `det-${n2}`;
          d.hidden = !isOpen;
          d.append(...c.details.map((t) => el("div", "detail", t)));
          tog.addEventListener("click", () => {
            d.hidden = !d.hidden;
            tog.setAttribute("aria-expanded", String(!d.hidden));
            expanded[d.hidden ? "delete" : "add"](keyOf2(c));
          });
          li.append(tog, d);
        }
        g.ol.append(li);
        const row = { li, btn: b2, c, g, show: true };
        rows.push(row);
        g.rows.push(row);
      });
      for (const k in counts2) $(`n-${k}`).textContent = counts2[k];
      $("total").textContent = res.changes.length;
      const nb = res.changes.filter((c) => c.breaking).length;
      $("n-breaking").textContent = nb;
      $("breaking").disabled = !nb && !breakOnly;
      $("summary").textContent = summary(res.changes);
      const tagCount = /* @__PURE__ */ new Map();
      for (const c of res.changes) tagCount.set(c.tag, (tagCount.get(c.tag) ?? 0) + 1);
      for (const t of tagsOn) if (!tagCount.has(t)) tagCount.set(t, 0);
      const toggleAll = $("toggle-all");
      $("tagbar").replaceChildren(
        ...[...tagCount].sort((a2, b2) => b2[1] - a2[1]).map(([t, n2]) => {
          const chip = el("button", "tchip", `${t} `);
          chip.type = "button";
          chip.dataset.tag = t;
          chip.setAttribute("aria-pressed", String(tagsOn.has(t)));
          chip.append(el("b", null, n2));
          return chip;
        }),
        toggleAll
      );
      $("filters").hidden = $("search-wrap").hidden = $("nav").hidden = $("tagbar").hidden = $("toolbar").hidden = $("summary").hidden = false;
      const want = selKey && (rows.find((r2) => r2.g.where === selKey.where && keyOf2(r2.c) === selKey.key) ?? rows.find((r2) => keyOf2(r2.c) === selKey.key));
      if (want && openSelected) open.add(want.g.where);
      applyFilters();
      if (selKey) {
        const again = want?.show ? want : null;
        if (again) {
          (selected = again.btn).classList.add("sel");
          showHl(again.c, false);
        }
        updatePos();
      }
      list.scrollTop = lastScroll;
    }
    const setView = (v2) => {
      view = v2;
      document.querySelectorAll("[data-view]").forEach((b2) => b2.setAttribute("aria-pressed", String(b2.dataset.view === v2)));
      run(true);
      if (selected) selected.scrollIntoView({ block: "center" });
      else list.scrollTop = 0;
    };
    const copyText = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        const ta = el("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      }
    };
    let copyTimer;
    $("copy").addEventListener("click", async () => {
      const b2 = $("copy");
      if (!result) return;
      const ok = await copyText(markdown(result));
      b2.focus();
      b2.textContent = ok ? "Copied" : "Copy failed";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => b2.textContent = "Copy report", 1500);
    });
    document.querySelectorAll("[data-view]").forEach((b2) => b2.addEventListener("click", () => view !== b2.dataset.view && setView(b2.dataset.view)));
    $("breaking").addEventListener("click", () => {
      breakOnly = !breakOnly;
      $("breaking").setAttribute("aria-pressed", String(breakOnly));
      applyFilters();
    });
    const select = (b2, focusEditor) => {
      selected?.classList.remove("sel");
      selected = b2;
      const row = rows.find((r) => r.btn === b2);
      selKey = { where: row.g.where, key: keyOf2(row.c) };
      b2.classList.add("sel");
      b2.scrollIntoView({ block: "nearest" });
      const c = b2.parentElement._change;
      const ed = editors[c.side];
      ed.setPosition({ lineNumber: c.line, column: 1 });
      showHl(c, true);
      if (focusEditor) ed.focus();
      updatePos();
    };
    list.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const btns = [...list.querySelectorAll(".ghead, .item")].filter((b2) => b2.offsetParent);
      const a2 = document.activeElement;
      const i2 = btns.indexOf(a2.closest(".ghead") ?? a2.closest("li")?.querySelector(".item"));
      const next = btns[Math.max(0, Math.min(btns.length - 1, i2 + (e.key === "ArrowDown" ? 1 : -1)))];
      if (!next) return;
      next.focus();
      if (next.classList.contains("item")) select(next, false);
    });
    $("toggle-all").addEventListener("click", () => {
      const all = groups.every((g) => !open.has(g.where));
      for (const g of groups) open[all ? "add" : "delete"](g.where);
      applyFilters();
    });
    $("prev").addEventListener("click", () => nav(-1));
    $("next").addEventListener("click", () => nav(1));
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "F8" && !document.body.classList.contains("edit") && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          nav(e.shiftKey ? -1 : 1);
        }
      },
      true
    );
    $("tagbar").addEventListener("click", (e) => {
      const chip = e.target.closest(".tchip");
      if (!chip) return;
      const t = chip.dataset.tag;
      tagsOn[tagsOn.has(t) ? "delete" : "add"](t);
      chip.setAttribute("aria-pressed", String(tagsOn.has(t)));
      applyFilters();
    });
    document.querySelectorAll(".chip").forEach(
      (chip) => chip.addEventListener("click", () => {
        const on = chip.getAttribute("aria-pressed") === "true";
        chip.setAttribute("aria-pressed", String(!on));
        hidden[on ? "add" : "delete"](chip.dataset.kind);
        applyFilters();
      })
    );
    $("search").addEventListener("input", applyFilters);
    initEditor({ $, el });
  }
})();
