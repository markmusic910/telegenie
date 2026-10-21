// ../libs/dist/polyfills/disposable-stack/index.js
if (typeof Symbol.dispose === "undefined") {
  Symbol.dispose = Symbol.for("Symbol.dispose");
}
if (typeof Symbol.asyncDispose === "undefined") {
  Symbol.asyncDispose = Symbol.for("Symbol.asyncDispose");
}
if (typeof SuppressedError === "undefined") {
  class SuppressedErrorClass extends Error {
    error;
    suppressed;
    constructor(error, suppressed, message) {
      super(message || "An error occurred during disposal");
      this.name = "SuppressedError";
      this.error = error;
      this.suppressed = suppressed;
    }
  }
  globalThis.SuppressedError = SuppressedErrorClass;
}
if (typeof DisposableStack === "undefined") {
  class DisposableStackClass {
    #disposables = [];
    #disposed = false;
    get disposed() {
      return this.#disposed;
    }
    dispose() {
      if (this.#disposed)
        return;
      this.#disposed = true;
      const errors = [];
      for (let i = this.#disposables.length - 1; i >= 0; i--) {
        try {
          this.#disposables[i]();
        } catch (e) {
          errors.push(e);
        }
      }
      this.#disposables = [];
      if (errors.length > 0) {
        if (errors.length === 1) {
          throw errors[0];
        }
        let suppressedError = errors[0];
        for (let i = 1; i < errors.length; i++) {
          suppressedError = new globalThis.SuppressedError(errors[i], suppressedError);
        }
        throw suppressedError;
      }
    }
    use(value) {
      if (this.#disposed) {
        throw new ReferenceError("DisposableStack has already been disposed");
      }
      if (value !== null && value !== void 0) {
        const disposeMethod = value[Symbol.dispose];
        if (typeof disposeMethod !== "function") {
          throw new TypeError("Object is not disposable");
        }
        this.#disposables.push(() => disposeMethod.call(value));
      }
      return value;
    }
    adopt(value, onDispose) {
      if (this.#disposed) {
        throw new ReferenceError("DisposableStack has already been disposed");
      }
      if (typeof onDispose !== "function") {
        throw new TypeError("onDispose must be a function");
      }
      this.#disposables.push(() => onDispose(value));
      return value;
    }
    defer(onDispose) {
      if (this.#disposed) {
        throw new ReferenceError("DisposableStack has already been disposed");
      }
      if (typeof onDispose !== "function") {
        throw new TypeError("onDispose must be a function");
      }
      this.#disposables.push(onDispose);
    }
    [Symbol.dispose]() {
      this.dispose();
    }
  }
  globalThis.DisposableStack = DisposableStackClass;
}
if (typeof AsyncDisposableStack === "undefined") {
  class AsyncDisposableStackClass {
    #disposables = [];
    #disposed = false;
    get disposed() {
      return this.#disposed;
    }
    async disposeAsync() {
      if (this.#disposed)
        return;
      this.#disposed = true;
      const errors = [];
      for (let i = this.#disposables.length - 1; i >= 0; i--) {
        try {
          await this.#disposables[i]();
        } catch (e) {
          errors.push(e);
        }
      }
      this.#disposables = [];
      if (errors.length > 0) {
        if (errors.length === 1) {
          throw errors[0];
        }
        let suppressedError = errors[0];
        for (let i = 1; i < errors.length; i++) {
          suppressedError = new globalThis.SuppressedError(errors[i], suppressedError);
        }
        throw suppressedError;
      }
    }
    use(value) {
      if (this.#disposed) {
        throw new ReferenceError("AsyncDisposableStack has already been disposed");
      }
      if (value !== null && value !== void 0) {
        const asyncDisposeMethod = value[Symbol.asyncDispose];
        if (typeof asyncDisposeMethod === "function") {
          this.#disposables.push(() => asyncDisposeMethod.call(value));
        } else {
          const disposeMethod = value[Symbol.dispose];
          if (typeof disposeMethod === "function") {
            this.#disposables.push(() => disposeMethod.call(value));
          } else {
            throw new TypeError("Object is not disposable");
          }
        }
      }
      return value;
    }
    adopt(value, onDispose) {
      if (this.#disposed) {
        throw new ReferenceError("AsyncDisposableStack has already been disposed");
      }
      if (typeof onDispose !== "function") {
        throw new TypeError("onDispose must be a function");
      }
      this.#disposables.push(() => onDispose(value));
      return value;
    }
    defer(onDispose) {
      if (this.#disposed) {
        throw new ReferenceError("AsyncDisposableStack has already been disposed");
      }
      if (typeof onDispose !== "function") {
        throw new TypeError("onDispose must be a function");
      }
      this.#disposables.push(onDispose);
    }
    async [Symbol.asyncDispose]() {
      await this.disposeAsync();
    }
  }
  globalThis.AsyncDisposableStack = AsyncDisposableStackClass;
}

// ../libs/dist/utils/generateUniqueId.js
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ../libs/dist/foundation/broadcast-channel/types.js
var DEFAULT_BROADCAST_CHANNEL_NAME = "telegenie";

// ../libs/dist/foundation/broadcast-channel/broadcast-bus.js
var BroadcastBus = class {
  name;
  senderId;
  channel;
  handlers = /* @__PURE__ */ new Map();
  anyHandlers = /* @__PURE__ */ new Set();
  closed = false;
  constructor(options = {}) {
    if (typeof BroadcastChannel === "undefined") {
      throw new Error("BroadcastBus requires BroadcastChannel");
    }
    this.name = options.name ?? DEFAULT_BROADCAST_CHANNEL_NAME;
    this.senderId = options.senderId ?? generateUniqueId();
    this.channel = new BroadcastChannel(this.name);
    this.channel.addEventListener("message", this.onMessage);
  }
  post(type, payload) {
    this.assertOpen();
    const envelope = {
      type,
      payload,
      senderId: this.senderId,
      ts: Date.now()
    };
    this.channel.postMessage(envelope);
  }
  on(type, handler) {
    this.assertOpen();
    const set = this.handlers.get(type) ?? /* @__PURE__ */ new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }
  /** Listen to every message type (still skips own echoes). */
  onAny(handler) {
    this.assertOpen();
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }
  once(type, handler) {
    const off = this.on(type, (envelope) => {
      off();
      handler(envelope);
    });
    return off;
  }
  off(type, handler) {
    const set = this.handlers.get(type);
    if (!set)
      return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(type);
    }
  }
  close() {
    if (this.closed)
      return;
    this.closed = true;
    this.channel.removeEventListener("message", this.onMessage);
    this.channel.close();
    this.handlers.clear();
    this.anyHandlers.clear();
  }
  onMessage = (ev) => {
    const envelope = ev.data;
    if (!envelope || typeof envelope !== "object" || typeof envelope.type !== "string") {
      return;
    }
    if (envelope.senderId === this.senderId) {
      return;
    }
    const typed = this.handlers.get(envelope.type);
    if (typed) {
      for (const handler of typed) {
        try {
          handler(envelope);
        } catch (err) {
          console.error("[BroadcastBus] handler error", err);
        }
      }
    }
    for (const handler of this.anyHandlers) {
      try {
        handler(envelope);
      } catch (err) {
        console.error("[BroadcastBus] onAny handler error", err);
      }
    }
  };
  assertOpen() {
    if (this.closed) {
      throw new Error("BroadcastBus is closed");
    }
  }
};
function createBroadcastBus(options) {
  return new BroadcastBus(options);
}

// ../libs/dist/foundation/broadcast-channel/tab-messages.js
var TAB_MSG = {
  hello: "tab.hello",
  heartbeat: "tab.heartbeat",
  leaderClaim: "tab.leaderClaim",
  leaderResign: "tab.leaderResign",
  leaderChallenge: "tab.leaderChallenge"
};
var LEADER_HEARTBEAT_TTL_MS = 8e3;

// ../libs/dist/foundation/telegram/worker/sw-bridge-protocol.js
var BRIDGE_KIND_INIT = "bridge.init";
var BRIDGE_KIND_READY = "bridge.ready";
var BRIDGE_LINK_SW_TELEGRAM = "sw-telegram";
var BRIDGE_LINK_SW_LEADER = "sw-leader";
var BRIDGE_READY_MESSAGE = { kind: BRIDGE_KIND_READY };
function createBridgeInitMessage(link) {
  return { kind: BRIDGE_KIND_INIT, payload: { link } };
}
var BRIDGE_INIT_SW_TELEGRAM = createBridgeInitMessage(BRIDGE_LINK_SW_TELEGRAM);
var BRIDGE_INIT_SW_LEADER = createBridgeInitMessage(BRIDGE_LINK_SW_LEADER);
function getBridgeLink(message) {
  if (!message || message.kind !== BRIDGE_KIND_INIT) {
    return void 0;
  }
  const link = message.payload?.link;
  if (link === BRIDGE_LINK_SW_TELEGRAM || link === BRIDGE_LINK_SW_LEADER) {
    return link;
  }
  const legacy = message.payload?.target;
  if (legacy === "telegram" || legacy === void 0) {
    return BRIDGE_LINK_SW_TELEGRAM;
  }
  if (legacy === "leader") {
    return BRIDGE_LINK_SW_LEADER;
  }
  return BRIDGE_LINK_SW_TELEGRAM;
}

// ../libs/dist/foundation/worker-rpc/types.js
var RpcError = class _RpcError extends Error {
  code;
  method;
  constructor(message, code, name, method) {
    super(method ? `[${method}] ${message}` : message);
    this.name = name ?? "RpcError";
    this.code = code;
    this.method = method;
  }
  static fromPayload(payload, method) {
    const error = new _RpcError(payload.message, payload.code, payload.name, method);
    if (payload.stack) {
      error.stack = payload.stack;
    }
    return error;
  }
  toPayload() {
    return {
      message: this.message,
      code: this.code,
      name: this.name,
      stack: this.stack
    };
  }
};

// ../libs/dist/foundation/worker-rpc/create-worker-client.js
function newRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function createWorkerClient(worker) {
  const pending = /* @__PURE__ */ new Map();
  const streams = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  const onMessage = (ev) => {
    const msg = ev.data;
    if (!msg || typeof msg !== "object" || !("kind" in msg)) {
      return;
    }
    if (msg.kind === "event") {
      const set = listeners.get(msg.event);
      if (!set)
        return;
      for (const handler of set) {
        try {
          handler(msg.payload);
        } catch (err) {
          console.error("[worker-rpc] event handler error", err);
        }
      }
      return;
    }
    if (msg.kind === "stream") {
      streams.get(msg.id)?.push(msg.value);
      return;
    }
    if (msg.kind === "stream-done") {
      const stream = streams.get(msg.id);
      if (stream) {
        streams.delete(msg.id);
        stream.end();
      }
      return;
    }
    if (msg.kind === "result") {
      const stream = streams.get(msg.id);
      if (stream) {
        streams.delete(msg.id);
        if (msg.ok === true) {
          stream.push(msg.value);
          stream.end();
        } else {
          stream.fail(RpcError.fromPayload(msg.error, String(msg.method)));
        }
        return;
      }
      const slot = pending.get(msg.id);
      if (!slot)
        return;
      pending.delete(msg.id);
      if (msg.ok === true) {
        slot.resolve(msg.value);
      } else {
        slot.reject(RpcError.fromPayload(msg.error, String(msg.method)));
      }
    }
  };
  worker.addEventListener("message", onMessage);
  function postCall(method, args, options, stream) {
    const id = newRequestId();
    const message = {
      kind: "call",
      id,
      method,
      args,
      stream: stream || void 0
    };
    worker.postMessage(message, options?.transfer);
    return id;
  }
  return {
    worker,
    call(method, args, options) {
      const id = postCall(method, args, options, false);
      const { promise, resolve, reject } = Promise.withResolvers();
      pending.set(id, {
        resolve,
        reject
      });
      return promise;
    },
    async *stream(method, args, options) {
      const id = postCall(method, args, options, true);
      const queue = [];
      let done = false;
      let error;
      let wake;
      const notify = () => {
        wake?.();
        wake = void 0;
      };
      streams.set(id, {
        push: (value) => {
          queue.push(value);
          notify();
        },
        end: () => {
          done = true;
          notify();
        },
        fail: (reason) => {
          error = reason;
          done = true;
          notify();
        }
      });
      try {
        while (true) {
          if (queue.length > 0) {
            yield queue.shift();
            continue;
          }
          if (error) {
            throw error;
          }
          if (done) {
            return;
          }
          await new Promise((resolve) => {
            wake = resolve;
          });
        }
      } finally {
        streams.delete(id);
      }
    },
    on(event, handler) {
      const set = listeners.get(event) ?? /* @__PURE__ */ new Set();
      set.add(handler);
      listeners.set(event, set);
      return () => {
        set.delete(handler);
        if (set.size === 0) {
          listeners.delete(event);
        }
      };
    },
    terminate() {
      worker.removeEventListener("message", onMessage);
      for (const [, slot] of pending) {
        slot.reject(new RpcError("Worker terminated", "WORKER_TERMINATED"));
      }
      pending.clear();
      for (const [, stream] of streams) {
        stream.fail(new RpcError("Worker terminated", "WORKER_TERMINATED"));
      }
      streams.clear();
      listeners.clear();
      if (typeof worker.terminate === "function") {
        worker.terminate();
      } else {
        worker.close?.();
      }
    }
  };
}

// ../libs/dist/utils/scheduler/sleep.js
function sleep(ms = 1e3) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/constants.ts
var DEBUG = true;
var APP_NAME = "TeleGenie";
var NOTIFICATION_ICON = "pwa-192x192.png";

// ../libs/dist/foundation/cache/constants.js
var LANG_CACHE_NAME = "tg-lang";
var ASSET_CACHE_NAME = "tg-assets";
var MEDIA_CACHE_NAME = "tg-media";
var MEDIA_CACHE_NAME_AVATARS = "tg-avatars";
var MEDIA_PROGRESSIVE_CACHE_NAME = "tg-media-progressive";
var CLEARABLE_CACHE_NAMES = [
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
  MEDIA_PROGRESSIVE_CACHE_NAME
];
var LAST_ACCESS_HEADER = "X-Last-Access";
var DEFAULT_CACHE_TTL = 5 * 24 * 60 * 60 * 1e3;
var DEFAULT_ACCESS_THROTTLE = 24 * 60 * 60 * 1e3;
var DEFAULT_CLEANUP_INTERVAL = 1 * 60 * 60 * 1e3;
var MEDIA_CACHE_MAX_BYTES = 5 * 1024 * 1024;
var MEDIA_PROGRESSIVE_CACHE_DISABLED = false;

// ../libs/dist/foundation/cache/types.js
var CacheDataType;
(function(CacheDataType2) {
  CacheDataType2[CacheDataType2["Text"] = 0] = "Text";
  CacheDataType2[CacheDataType2["Blob"] = 1] = "Blob";
  CacheDataType2[CacheDataType2["Json"] = 2] = "Json";
  CacheDataType2[CacheDataType2["ArrayBuffer"] = 3] = "ArrayBuffer";
})(CacheDataType || (CacheDataType = {}));

// ../libs/src/utils/scheduler/yield.ts
function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// ../libs/dist/foundation/cache/cache-manager.js
var CacheManager = class {
  cacheApi = typeof self !== "undefined" ? self.caches : void 0;
  isSupportedCached;
  cleanupIntervalId;
  clearableCacheNames;
  cacheTtl;
  /** Min interval between X-Last-Access rewrites on cache hits (avoids put-per-read). */
  accessThrottle;
  cleanupInterval;
  cacheKeyBase;
  constructor(options = {}) {
    this.clearableCacheNames = options.clearableCacheNames ?? CLEARABLE_CACHE_NAMES;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.accessThrottle = options.accessThrottle ?? DEFAULT_ACCESS_THROTTLE;
    this.cleanupInterval = options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL;
    let defaultBase = "http://localhost/";
    if (typeof self !== "undefined" && self.location && self.location.origin) {
      defaultBase = `${self.location.origin}/`;
    }
    this.cacheKeyBase = options.cacheKeyBase ?? defaultBase;
    if (this.cacheApi && this.cleanupInterval > 0) {
      setTimeout(() => {
        this.cleanup(this.clearableCacheNames).catch((err) => {
          console.warn("CacheManager initial cleanup failed:", err);
        });
      }, 1e3);
      this.cleanupIntervalId = setInterval(() => {
        this.cleanup(this.clearableCacheNames).catch((err) => {
          console.warn("CacheManager scheduled cleanup failed:", err);
        });
      }, this.cleanupInterval);
    }
  }
  destroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = void 0;
    }
  }
  async isCacheApiSupported() {
    if (!this.cacheApi)
      return false;
    if (this.isSupportedCached === void 0) {
      try {
        this.isSupportedCached = await this.cacheApi.has("test").then(() => true).catch(() => false);
      } catch {
        this.isSupportedCached = false;
      }
    }
    return this.isSupportedCached;
  }
  getCacheName(cacheName, accountSlot) {
    if (cacheName === LANG_CACHE_NAME)
      return cacheName;
    const suffix = accountSlot ? `_${accountSlot}` : "";
    return `${cacheName}${suffix}`;
  }
  /** @deprecated String-key helpers only — prefer a real Request. */
  buildCacheRequest(key) {
    const normalizedKey = key.replace(/:/g, "_");
    return new Request(new URL(normalizedKey, this.cacheKeyBase));
  }
  toRequest(request) {
    return request instanceof Request ? request : new Request(request);
  }
  withLastAccess(response) {
    const headers = new Headers(response.headers);
    headers.set(LAST_ACCESS_HEADER, Date.now().toString());
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  async updateAccessTime(cache, request, response) {
    try {
      await cache.put(request, this.withLastAccess(response.clone()));
    } catch (err) {
      console.warn("Failed to update cache access time:", err);
    }
  }
  maybeRefreshAccessTime(cache, request, response) {
    const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
    const now = Date.now();
    if (!lastAccess || now - lastAccess > this.accessThrottle) {
      this.updateAccessTime(cache, this.toRequest(request), response).catch((err) => {
        console.warn("Non-blocking access time update failed:", err);
      });
    }
  }
  /**
   * Primary read: Cache API match by Request.
   * Refreshes `X-Last-Access` (throttled) so TTL cleanup keeps hot entries.
   */
  async match(cacheName, request, options) {
    if (!this.cacheApi) {
      return void 0;
    }
    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      const response = await cache.match(request);
      if (!response) {
        return void 0;
      }
      this.maybeRefreshAccessTime(cache, request, response);
      return response;
    } catch (err) {
      console.warn(`CacheManager match failed in cache "${cacheName}":`, err);
      return void 0;
    }
  }
  /**
   * Primary write: Cache API put by Request.
   * Stamps `X-Last-Access` for TTL eviction. Callers that still need the body
   * should pass `response.clone()`.
   */
  async put(cacheName, request, response, options) {
    if (!this.cacheApi) {
      return false;
    }
    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      await cache.put(request, this.withLastAccess(response));
      return true;
    } catch (err) {
      console.warn(`CacheManager put failed in cache "${cacheName}":`, err);
      return false;
    }
  }
  /**
   * Primary delete: Cache API delete by Request.
   */
  async delete(cacheName, request, options) {
    if (!this.cacheApi) {
      return void 0;
    }
    try {
      const { accountSlot } = options || {};
      const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
      return await cache.delete(request);
    } catch (err) {
      console.warn(`CacheManager delete failed in cache "${cacheName}":`, err);
      return void 0;
    }
  }
  /**
   * @deprecated Prefer {@link match} with a Request key.
   */
  async fetch(cacheName, key, type, options) {
    if (!this.cacheApi) {
      return void 0;
    }
    try {
      const { isHtmlAllowed = false } = options || {};
      const response = await this.match(cacheName, this.buildCacheRequest(key), options);
      if (!response) {
        return void 0;
      }
      const contentType = response.headers.get("Content-Type");
      switch (type) {
        case CacheDataType.Text:
          return await response.text();
        case CacheDataType.Blob: {
          if (key.startsWith("avatar") && contentType && contentType.startsWith("text")) {
            return void 0;
          }
          const blob = await response.blob();
          const shouldRecreate = !blob.type || !isHtmlAllowed && blob.type.includes("html");
          let resolvedType = blob.type || contentType || "";
          if (!(shouldRecreate && resolvedType)) {
            return blob;
          }
          if (!isHtmlAllowed) {
            resolvedType = resolvedType.replace(/html/gi, "");
          }
          return new Blob([blob], { type: resolvedType });
        }
        case CacheDataType.Json:
          return await response.json();
        case CacheDataType.ArrayBuffer:
          return await response.arrayBuffer();
        default:
          return void 0;
      }
    } catch (err) {
      console.warn(`CacheManager fetch failed for key "${key}" in cache "${cacheName}":`, err);
      return void 0;
    }
  }
  /**
   * @deprecated Prefer {@link put} with a Request key.
   */
  async save(cacheName, key, data, options) {
    if (!this.cacheApi) {
      return false;
    }
    try {
      const cacheData = typeof data === "string" || data instanceof Blob || data instanceof ArrayBuffer ? data : JSON.stringify(data);
      const response = new Response(cacheData);
      if (data instanceof Blob && data.type) {
        response.headers.set("Content-Type", data.type);
      } else if (typeof data === "object" && !(data instanceof ArrayBuffer)) {
        response.headers.set("Content-Type", "application/json");
      }
      return await this.put(cacheName, this.buildCacheRequest(key), response, options);
    } catch (err) {
      console.warn(`CacheManager save failed for key "${key}" in cache "${cacheName}":`, err);
      return false;
    }
  }
  /**
   * @deprecated Prefer {@link delete} with a Request key.
   */
  async remove(cacheName, key, options) {
    return this.delete(cacheName, this.buildCacheRequest(key), options);
  }
  async clear(cacheName, options) {
    if (!this.cacheApi) {
      return void 0;
    }
    try {
      const { accountSlot } = options || {};
      return await this.cacheApi.delete(this.getCacheName(cacheName, accountSlot));
    } catch (err) {
      console.warn(`CacheManager clear failed for cache "${cacheName}":`, err);
      return void 0;
    }
  }
  async cleanup(cacheNames, options) {
    if (!this.cacheApi)
      return;
    try {
      const { accountSlot } = options || {};
      for (const cacheName of cacheNames) {
        const cache = await this.cacheApi.open(this.getCacheName(cacheName, accountSlot));
        const keys = await cache.keys();
        const now = Date.now();
        for (const request of keys) {
          await yieldToMain();
          const response = await cache.match(request);
          if (!response)
            continue;
          const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
          if (lastAccess && now - lastAccess > this.cacheTtl) {
            await cache.delete(request);
          }
        }
      }
    } catch (err) {
      console.warn("CacheManager cleanup failed:", err);
    }
  }
  purgeClearableCache(options) {
    const { accountSlot } = options || {};
    this.clearableCacheNames.forEach((cacheName) => {
      this.clear(cacheName, { accountSlot }).catch((err) => {
        console.warn(`Failed to clear cache "${cacheName}" during purge:`, err);
      });
    });
  }
};
var cacheManager = new CacheManager();

// ../libs/dist/foundation/telegram/constants.js
var DUMMY_DOMAIN = "https://telegenie.local";
var DEFAULT_AVATAR_MIME = "image/jpeg";

// ../libs/dist/foundation/telegram/media/peer-avatar-url.js
function parsePeerAvatarUrl(url) {
  const parsed = new URL(url, DUMMY_DOMAIN);
  const peerId = parsed.searchParams.get("peerId");
  const photoId = parsed.searchParams.get("photoId");
  const dcIdParam = parsed.searchParams.get("dcId");
  if (!peerId || !photoId || !dcIdParam) {
    return void 0;
  }
  const dcId = Number(dcIdParam);
  if (!Number.isFinite(dcId)) {
    return void 0;
  }
  const mimeType = parsed.searchParams.get("mimeType") ?? DEFAULT_AVATAR_MIME;
  const big = parsed.searchParams.get("big");
  return {
    peerId,
    photoId,
    dcId,
    mimeType,
    isBig: big === "1" || big === "true" || void 0
  };
}

// src/share.ts
async function respondForShare(e) {
  if (e.request.method === "POST") {
    try {
      const formData = await e.request.formData();
      const data = parseFormData(formData);
      void requestShare(data, e.resultingClientId);
    } catch (err) {
      console.warn("[SHARE] Failed to parse input data", err);
    }
  }
  return Response.redirect(".");
}
async function requestShare(data, clientId) {
  const client = await self.clients.get(clientId);
  if (!client) {
    return;
  }
  client.postMessage({
    type: "share",
    payload: data
  });
}
function parseFormData(formData) {
  const files = formData.getAll("files");
  const title = formData.get("title");
  const text = formData.get("text");
  const url = formData.get("url");
  return {
    title,
    text,
    url,
    files
  };
}

// src/fetch-manager.ts
var RE_NETWORK_FIRST_ASSETS = /\.(wasm|html)$/;
var RE_CACHE_FIRST_ASSETS = /[\da-f]{20}.*\.(js|css|woff2?|svg|png|jpg|jpeg|tgs|json|wasm)$/;
function cacheableMediaRequest(request) {
  if (!request.headers.has("range")) return request;
  const headers = new Headers(request.headers);
  headers.delete("range");
  return new Request(request.url, { method: "GET", headers });
}
var CACHE_HIT_HEADER = "X-TG-Cache";
function withCacheHitHeader(cached, cacheName) {
  const headers = new Headers(cached.headers);
  headers.set(CACHE_HIT_HEADER, cacheName);
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers
  });
}
var ASSET_TIMEOUT = 3e3;
var MB = 1024 * 1024;
var DEFAULT_PART_SIZE = 0.5 * MB;
var MAX_END_TO_CACHE = 5 * MB - 1;
var DOWNLOAD_PART_SIZE = 1024 * 1024;
var TEST_PART_SIZE = 64 * 1024;
var DOWNLOAD_QUEUE_SIZE = 8;
var FilePartQueue = class {
  queue = [];
  push(task) {
    this.queue.push(task);
  }
  async pop() {
    return this.queue.shift();
  }
  get size() {
    return this.queue.length;
  }
};
var FetchManager = class {
  getTelegramRpc;
  assetCacheManager = new CacheManager({ cleanupInterval: 0 });
  progressiveCacheManager = new CacheManager();
  mediaCacheManager = new CacheManager();
  constructor(options) {
    this.getTelegramRpc = options.getTelegramRpc;
  }
  init() {
    self.addEventListener("fetch", (e) => this.handleFetch(e));
  }
  clearAssetCache() {
    return this.assetCacheManager.clear(ASSET_CACHE_NAME);
  }
  handleFetch(e) {
    const { url } = e.request;
    const { scope } = self.registration;
    if (!url.startsWith(scope)) {
      return;
    }
    const { pathname, protocol } = new URL(url);
    const { pathname: scopePathname } = new URL(scope);
    const scopePrefix = scopePathname.endsWith("/") ? scopePathname : `${scopePathname}/`;
    if (pathname.startsWith(`${scopePrefix}progressive/`)) {
      e.respondWith(this.respondForProgressive(e));
      return;
    }
    if (pathname.startsWith(`${scopePrefix}media/`)) {
      e.respondWith(this.respondForCachedMedia(e, MEDIA_CACHE_NAME));
      return;
    }
    if (pathname.startsWith(`${scopePrefix}avatar/`)) {
      e.respondWith(this.respondForCachedAvatar(e));
      return;
    }
    if (pathname.startsWith(`${scopePrefix}download/`)) {
      e.respondWith(this.respondForDownload(e));
      return;
    }
    if (pathname.startsWith(`${scopePrefix}share/`)) {
      e.respondWith(respondForShare(e));
    }
    if (protocol === "http:" || protocol === "https:") {
      if (pathname === scopePathname || pathname.match(RE_NETWORK_FIRST_ASSETS)) {
        e.respondWith(this.respondWithCacheNetworkFirst(e));
        return;
      }
      if (pathname.match(RE_CACHE_FIRST_ASSETS)) {
        e.respondWith(this.respondWithCache(e));
      }
    }
  }
  // --- Telegram-backed part fetch ------------------------------------------------
  async requestPart(params) {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      console.error("[SW] requestPart: Telegram RPC is not connected (sw-telegram bridge missing)");
      return void 0;
    }
    const parsed = new URL(params.url);
    const fileId = parsed.searchParams.get("fileId");
    const accessHash = parsed.searchParams.get("accessHash");
    const dcIdParam = parsed.searchParams.get("dcId");
    if (!fileId || !accessHash || !dcIdParam) {
      console.error("[SW] requestPart: Missing required params (fileId, accessHash, or dcId)", {
        fileId,
        accessHash,
        dcIdParam,
        url: params.url
      });
      return void 0;
    }
    const dcId = Number(dcIdParam);
    if (!Number.isFinite(dcId)) {
      console.error("[SW] requestPart: Invalid dcId", dcIdParam);
      return void 0;
    }
    const mimeType = parsed.searchParams.get("mimeType") ?? void 0;
    const fileSizeParam = parsed.searchParams.get("fileSize");
    const fullSize = fileSizeParam ? Number(fileSizeParam) : void 0;
    const thumbSize = parsed.searchParams.get("thumbSize") ?? void 0;
    const peerId = parsed.searchParams.get("peerId") ?? void 0;
    const messageIdParam = parsed.searchParams.get("messageId");
    const messageId = messageIdParam ? Number(messageIdParam) : void 0;
    if (DEBUG) {
      console.log("[SW] requestPart: calling file.getPart via Telegram SharedWorker RPC", {
        fileId,
        start: params.start,
        end: params.end,
        dcId,
        mimeType,
        fullSize
      });
    }
    try {
      const res = await rpc.call("file.getPart", [
        {
          fileId,
          start: params.start,
          end: params.end,
          accessHash,
          dcId,
          mimeType,
          fullSize: fullSize && Number.isFinite(fullSize) ? fullSize : void 0,
          thumbSize: thumbSize ?? void 0,
          peerId,
          messageId: messageId && Number.isFinite(messageId) ? messageId : void 0
        }
      ]);
      if (DEBUG) {
        console.log("[SW] requestPart: file.getPart succeeded", {
          fileId,
          bytesReceived: res?.arrayBuffer?.byteLength,
          fullSize: res?.fullSize,
          mimeType: res?.mimeType
        });
      }
      return res;
    } catch (err) {
      console.error("[SW] requestPart: file.getPart failed:", err, {
        fileId,
        start: params.start,
        end: params.end,
        dcId
      });
      return void 0;
    }
  }
  // --- Cached full media / avatars -----------------------------------------------
  parseDownloadItem(url) {
    const parsed = new URL(url);
    const fileId = parsed.searchParams.get("fileId");
    const accessHash = parsed.searchParams.get("accessHash");
    const dcIdParam = parsed.searchParams.get("dcId");
    if (!fileId || !accessHash || !dcIdParam) {
      return void 0;
    }
    const dcId = Number(dcIdParam);
    if (!Number.isFinite(dcId)) {
      return void 0;
    }
    const mimeType = parsed.searchParams.get("mimeType") ?? void 0;
    const fileSizeParam = parsed.searchParams.get("fileSize");
    const fullSize = fileSizeParam ? Number(fileSizeParam) : void 0;
    const thumbSize = parsed.searchParams.get("thumbSize") ?? void 0;
    const peerId = parsed.searchParams.get("peerId") ?? void 0;
    const messageIdParam = parsed.searchParams.get("messageId");
    const messageId = messageIdParam ? Number(messageIdParam) : void 0;
    return {
      fileId,
      accessHash,
      dcId,
      mimeType,
      fullSize: fullSize && Number.isFinite(fullSize) ? fullSize : void 0,
      thumbSize: thumbSize ?? void 0,
      peerId,
      messageId: messageId && Number.isFinite(messageId) ? messageId : void 0
    };
  }
  async requestDownloadFiles(items) {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      return void 0;
    }
    try {
      return await rpc.call("file.downloadFiles", [items]);
    } catch (err) {
      if (DEBUG) {
        console.error("FETCH file.downloadFiles", err);
      }
      return void 0;
    }
  }
  async requestDownloadPeerPhotos(items) {
    const rpc = this.getTelegramRpc();
    if (!rpc) {
      return void 0;
    }
    try {
      return await rpc.call("file.downloadPeerPhotos", [items]);
    } catch (err) {
      if (DEBUG) {
        console.error("FETCH file.downloadPeerPhotos", err);
      }
      return void 0;
    }
  }
  async respondWithDownloadedBlob(e, cacheName, downloaded) {
    const { arrayBuffer, mimeType } = downloaded;
    const response = new Response(arrayBuffer, {
      status: 200,
      statusText: "OK",
      headers: [
        ["Content-Type", mimeType],
        ["Content-Length", String(arrayBuffer.byteLength)]
      ]
    });
    if (arrayBuffer.byteLength <= MEDIA_CACHE_MAX_BYTES) {
      const write = this.mediaCacheManager.put(
        cacheName,
        cacheableMediaRequest(e.request),
        response.clone()
      );
      e.waitUntil(write);
    }
    return response;
  }
  async respondForCachedMedia(e, cacheName) {
    const cached = await this.mediaCacheManager.match(cacheName, cacheableMediaRequest(e.request));
    if (cached) {
      return withCacheHitHeader(cached, cacheName);
    }
    const item = this.parseDownloadItem(e.request.url);
    if (!item) {
      return new Response("", {
        status: 400,
        statusText: "Missing media location params"
      });
    }
    const results = await this.requestDownloadFiles([item]);
    const downloaded = results?.[0];
    if (!downloaded) {
      return new Response("", {
        status: 500,
        statusText: "Failed to download media"
      });
    }
    return this.respondWithDownloadedBlob(e, cacheName, downloaded);
  }
  async respondForCachedAvatar(e) {
    const cached = await this.mediaCacheManager.match(MEDIA_CACHE_NAME_AVATARS, e.request);
    if (cached) {
      return withCacheHitHeader(cached, MEDIA_CACHE_NAME_AVATARS);
    }
    const item = parsePeerAvatarUrl(e.request.url);
    if (!item) {
      return new Response("", {
        status: 400,
        statusText: "Missing media location params"
      });
    }
    const results = await this.requestDownloadPeerPhotos([item]);
    const downloaded = results?.[0];
    if (!downloaded) {
      return new Response("", {
        status: 500,
        statusText: "Failed to download media"
      });
    }
    return this.respondWithDownloadedBlob(e, MEDIA_CACHE_NAME_AVATARS, downloaded);
  }
  // --- Progressive media ---------------------------------------------------------
  async respondForProgressive(e) {
    const { url } = e.request;
    const accountSlot = void 0;
    const range = e.request.headers.get("range");
    let start = 0;
    let originalEnd;
    if (range) {
      const match = /^bytes=(\d+)-(\d+)?$/.exec(range);
      if (match) {
        start = Number(match[1]);
        if (match[2]) {
          originalEnd = Number(match[2]);
        }
      }
    }
    let end = originalEnd;
    if (!end || end - start + 1 > DEFAULT_PART_SIZE) {
      end = start + DEFAULT_PART_SIZE - 1;
    }
    const parsedUrl = new URL(url);
    const fileSizeStr = parsedUrl.searchParams.get("fileSize");
    const fileSize = fileSizeStr ? Number(fileSizeStr) : void 0;
    if (fileSize && Number.isFinite(fileSize) && fileSize > 0) {
      end = Math.min(end, fileSize - 1);
    }
    if (DEBUG) {
      console.log(
        `[SW] respondForProgressive: start=${start}, end=${end}, originalEnd=${originalEnd}, range="${range}"`,
        url
      );
    }
    if (start === 0 && end === 1) {
      const fileSizeParam = parsedUrl.searchParams.get("fileSize");
      const fileSize2 = fileSizeParam && Number(fileSizeParam);
      const mimeType2 = parsedUrl.searchParams.get("mimeType");
      if (fileSize2 && mimeType2) {
        if (DEBUG) {
          console.log(`[SW] respondForProgressive Safari probe (0-1), returning 206 for ${url}`);
        }
        return new Response(new Uint8Array(2).buffer, {
          status: 206,
          statusText: "Partial Content",
          headers: [
            ["Content-Range", `bytes 0-1/${fileSize2}`],
            ["Accept-Ranges", "bytes"],
            ["Content-Length", "2"],
            ["Content-Type", mimeType2]
          ]
        });
      }
    }
    parsedUrl.searchParams.set("start", String(start));
    parsedUrl.searchParams.set("end", String(end));
    const cacheKey = parsedUrl.href;
    const cachedResponse = !MEDIA_PROGRESSIVE_CACHE_DISABLED ? await this.fetchProgressiveFromCache(accountSlot, cacheKey) : void 0;
    if (DEBUG) {
      console.log(
        `[SW] FETCH PROGRESSIVE ${cacheKey} (request: ${start}-${originalEnd}) CACHED: ${Boolean(cachedResponse)}`
      );
    }
    if (cachedResponse) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      const requestedEnd = originalEnd != null ? Math.min(originalEnd, end) : end;
      const requestedLength = requestedEnd - start + 1;
      const servesSlice = requestedLength < cachedBuffer.byteLength;
      const body = servesSlice ? cachedBuffer.slice(0, requestedLength) : cachedBuffer;
      const responseHeaders = new Headers(cachedResponse.headers);
      responseHeaders.set(CACHE_HIT_HEADER, MEDIA_PROGRESSIVE_CACHE_NAME);
      if (servesSlice) {
        const fullSize2 = responseHeaders.get("Content-Range")?.split("/")?.[1] ?? "*";
        responseHeaders.set("Content-Range", `bytes ${start}-${requestedEnd}/${fullSize2}`);
        responseHeaders.set("Content-Length", String(body.byteLength));
      }
      return new Response(body, {
        status: 206,
        statusText: "Partial Content",
        headers: responseHeaders
      });
    }
    let partInfo;
    try {
      partInfo = await this.requestPart({ url, start, end });
    } catch (err) {
      console.error("[SW] FETCH PROGRESSIVE requestPart error:", err);
    }
    if (!partInfo) {
      console.error("[SW] Failed to fetch progressive part, returning 500 for:", url);
      return new Response("", {
        status: 500,
        statusText: "Failed to fetch progressive part"
      });
    }
    const { arrayBuffer, fullSize, mimeType } = partInfo;
    const partSize = Math.min(end - start + 1, arrayBuffer.byteLength);
    end = start + partSize - 1;
    const arrayBufferPart = arrayBuffer.slice(0, partSize);
    const headers = [
      ["Content-Range", `bytes ${start}-${end}/${fullSize}`],
      ["Accept-Ranges", "bytes"],
      ["Content-Length", String(partSize)],
      ["Content-Type", mimeType]
    ];
    if (!MEDIA_PROGRESSIVE_CACHE_DISABLED && partSize <= MEDIA_CACHE_MAX_BYTES && end < MAX_END_TO_CACHE) {
      parsedUrl.searchParams.set("end", String(end));
      const actualCacheKey = parsedUrl.href;
      void this.saveProgressiveToCache(accountSlot, actualCacheKey, arrayBufferPart, headers);
    }
    return new Response(arrayBufferPart, {
      status: 206,
      statusText: "Partial Content",
      headers
    });
  }
  // Cache API forbids status 206 responses, but allows status 200 with custom headers.
  async fetchProgressiveFromCache(accountSlot, cacheKey) {
    const options = accountSlot != null ? { accountSlot: String(accountSlot) } : void 0;
    try {
      const cached = await this.progressiveCacheManager.match(
        MEDIA_PROGRESSIVE_CACHE_NAME,
        new Request(cacheKey),
        options
      );
      if (cached) {
        return cached;
      }
    } catch (err) {
      console.warn("[SW] fetchProgressiveFromCache error:", err);
    }
    return void 0;
  }
  async saveProgressiveToCache(accountSlot, cacheKey, arrayBuffer, headers) {
    const options = accountSlot != null ? { accountSlot: String(accountSlot) } : void 0;
    const response200 = new Response(arrayBuffer, {
      status: 200,
      statusText: "OK",
      headers
    });
    return this.progressiveCacheManager.put(
      MEDIA_PROGRESSIVE_CACHE_NAME,
      new Request(cacheKey),
      response200,
      options
    );
  }
  // --- Full-file download stream -------------------------------------------------
  async respondForDownload(e) {
    const { url } = e.request;
    let partInfo;
    try {
      partInfo = await this.requestPart({ url, start: 0, end: TEST_PART_SIZE });
    } catch (err) {
      if (DEBUG) {
        console.error("FETCH DOWNLOAD", err);
      }
    }
    if (!partInfo) {
      return new Response("", {
        status: 500,
        statusText: "Failed to fetch file to download"
      });
    }
    const matchedFilename = e.request.url.match(/filename=(.*)/);
    const filenameHeader = matchedFilename ? `filename="${decodeURIComponent(matchedFilename[1])}"` : "";
    const { fullSize, mimeType } = partInfo;
    const headers = [
      ["Content-Length", String(fullSize)],
      ["Content-Type", mimeType],
      ["Content-Disposition", `attachment; ${filenameHeader}`]
    ];
    const queue = new FilePartQueue();
    const enqueue = (offset) => {
      queue.push(
        this.requestPart({
          url,
          start: offset,
          end: offset + DOWNLOAD_PART_SIZE - 1
        }).then((part) => part?.arrayBuffer)
      );
      return offset + DOWNLOAD_PART_SIZE;
    };
    let lastOffset = 0;
    const stream = new ReadableStream({
      start() {
        for (let i = 0; i < DOWNLOAD_QUEUE_SIZE; i++) {
          if (lastOffset >= fullSize) break;
          lastOffset = enqueue(lastOffset);
        }
      },
      async pull(controller) {
        const buffer = await queue.pop();
        if (!buffer) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(buffer));
        if (buffer.byteLength < DOWNLOAD_PART_SIZE) {
          controller.close();
          return;
        }
        if (lastOffset < fullSize) {
          lastOffset = enqueue(lastOffset);
        }
      }
    });
    return new Response(stream, {
      status: 200,
      statusText: "OK",
      headers
    });
  }
  // --- Asset cache strategies ----------------------------------------------------
  async respondWithCacheNetworkFirst(e) {
    const remote = await this.withTimeout(() => fetch(e.request), ASSET_TIMEOUT);
    if (!remote?.ok) {
      return this.respondWithCache(e);
    }
    const toCache = remote.clone();
    void this.assetCacheManager.put(ASSET_CACHE_NAME, e.request, toCache);
    return remote;
  }
  async respondWithCache(e) {
    const cacheResult = await this.withTimeout(async () => {
      const cached2 = await this.assetCacheManager.match(ASSET_CACHE_NAME, e.request);
      return { cached: cached2, ready: true };
    }, ASSET_TIMEOUT);
    const cached = cacheResult?.cached;
    if (cached) {
      if (cached.ok) {
        return withCacheHitHeader(cached, ASSET_CACHE_NAME);
      }
      await this.assetCacheManager.delete(ASSET_CACHE_NAME, e.request);
    }
    const remote = await fetch(e.request);
    if (remote.ok && cacheResult?.ready) {
      void this.assetCacheManager.put(ASSET_CACHE_NAME, e.request, remote.clone());
    }
    return remote;
  }
  async withTimeout(cb, timeout) {
    let isResolved = false;
    try {
      return await Promise.race([
        sleep(timeout).then(() => isResolved ? void 0 : Promise.reject(new Error("TIMEOUT"))),
        cb()
      ]);
    } catch (err) {
      console.error(err);
      return void 0;
    } finally {
      isResolved = true;
    }
  }
};

// src/notification-manager.ts
var NotificationManager = class {
  lastSyncAt = Date.now();
  getLeaderRpc;
  constructor(options) {
    this.getLeaderRpc = options.getLeaderRpc;
  }
  init() {
    self.addEventListener("notificationclick", (e) => this.handleNotificationClick(e));
    self.addEventListener("sync", () => {
      this.lastSyncAt = Date.now();
    });
  }
  async onTelegramMessageNotification(payload) {
    try {
      if (await this.hasFocusedClient()) {
        console.log("hasFocusedClient skip notification");
        return;
      }
      await this.showNotification({
        chatId: payload.chatId,
        messageId: payload.messageId,
        title: payload.title || APP_NAME,
        body: payload.body,
        isSilent: payload.isSilent,
        reaction: payload.reaction
      });
    } catch (error) {
      if (DEBUG) {
        console.warn("[SW] onTelegramMessageNotification failed", error);
      }
    }
  }
  async hasFocusedClient() {
    const clients = await this.getClients();
    return clients.some((client) => client.focused);
  }
  async getClients() {
    const appUrl = new URL(self.registration.scope).origin;
    const clients = await self.clients.matchAll({ type: "window" });
    return clients.filter((client) => new URL(client.url).origin === appUrl);
  }
  /** Resolve notification assets against the SW scope so Chromium gets an absolute URL. */
  assetUrl(path) {
    return new URL(path, self.registration.scope).href;
  }
  async playNotificationSound(id) {
    const leaderRpc = this.getLeaderRpc();
    if (!leaderRpc) return;
    try {
      await leaderRpc.call("playNotificationSound", [id]);
    } catch (error) {
      if (DEBUG) {
        console.warn("[SW] playNotificationSound failed", error);
      }
    }
  }
  async showNotification({
    chatId,
    messageId,
    body,
    title,
    icon,
    reaction,
    isSilent,
    shouldReplaceHistory
  }) {
    const soundPromise = !reaction && !isSilent ? this.playNotificationSound(String(messageId ?? chatId ?? "")) : void 0;
    let permission;
    try {
      permission = typeof Notification !== "undefined" ? Notification.permission : void 0;
    } catch {
      permission = void 0;
    }
    if (permission != null && permission !== "granted") {
      await soundPromise;
      return;
    }
    const isFirstBatch = Date.now() - this.lastSyncAt < 1e3;
    const tag = String(isFirstBatch ? 0 : chatId || 0);
    const iconUrl = this.assetUrl(icon || NOTIFICATION_ICON);
    const options = {
      body,
      data: {
        chatId,
        messageId,
        reaction,
        count: 1,
        shouldReplaceHistory
      },
      icon: iconUrl,
      badge: iconUrl,
      tag,
      // @ts-expect-error vibrate is non-standard but widely supported
      vibrate: [200, 100, 200]
    };
    try {
      await Promise.all([soundPromise, self.registration.showNotification(title, options)]);
    } catch (error) {
      if (DEBUG) {
        console.warn("[SW] showNotification failed", error);
      }
    }
  }
  /** Ask the leader tab only to focus / deep-link (via sw-leader bridge). */
  async focusLeaderMessage(data) {
    const leaderRpc = this.getLeaderRpc();
    if (!leaderRpc || !data.chatId) {
      return false;
    }
    try {
      await leaderRpc.call("focusMessage", [data]);
      return true;
    } catch (error) {
      if (DEBUG) {
        console.warn("[SW] focusMessage (leader) failed", error);
      }
      return false;
    }
  }
  handleNotificationClick(e) {
    const appUrl = self.registration.scope;
    e.notification.close();
    const data = e.notification.data ?? {};
    e.waitUntil(
      (async () => {
        const focusedLeader = await this.focusLeaderMessage(data);
        if (focusedLeader) {
          return;
        }
        if (!self.clients.openWindow) return;
        const clients = await this.getClients();
        if (clients.length > 0) return;
        try {
          await self.clients.openWindow(appUrl);
        } catch (error) {
          if (DEBUG) {
            console.warn("[SW] ", error);
          }
        }
      })()
    );
  }
};

// src/telegenie.service-worker.ts
var ACTIVATE_TIMEOUT = 3e3;
var TeleGenieServiceWorker = class {
  initialized = false;
  broadcast;
  leaderUnsubscribers = [];
  _leaderTabId;
  leaderHeartbeatAt = 0;
  telegramSlot;
  leaderSlot;
  unsubTelegramNotifications;
  notifications = new NotificationManager({
    getLeaderRpc: () => this.leaderRpc
  });
  fetchManager = new FetchManager({
    getTelegramRpc: () => this.telegramRpc
  });
  get leaderTabId() {
    return this._leaderTabId;
  }
  get telegramRpc() {
    return this.telegramSlot?.client;
  }
  get leaderRpc() {
    return this.leaderSlot?.client;
  }
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.initLeaderTracker();
    this.initLifecycleListeners();
    this.fetchManager.init();
    this.notifications.init();
    this.initBridgeMessageListener();
  }
  initLeaderTracker() {
    this.broadcast = createBroadcastBus({ name: DEFAULT_BROADCAST_CHANNEL_NAME });
    this.leaderUnsubscribers.push(
      this.broadcast.on(TAB_MSG.heartbeat, (env) => {
        const { tabId, heartbeatAt } = env.payload;
        if (!tabId) return;
        if (this._leaderTabId === tabId || !this.isLeaderFresh()) {
          this.setLeader(tabId, heartbeatAt);
        }
      }),
      this.broadcast.on(TAB_MSG.leaderClaim, (env) => {
        const claimer = env.payload.tabId;
        if (!claimer) return;
        this.onLeaderClaim(claimer, env.payload.heartbeatAt);
      }),
      this.broadcast.on(TAB_MSG.leaderResign, (env) => {
        if (env.payload.tabId && env.payload.tabId === this._leaderTabId) {
          this.clearLeader();
          this.disposeLeaderBridge();
        }
      })
    );
  }
  isLeaderFresh(now = Date.now()) {
    if (!this._leaderTabId) return false;
    return now - this.leaderHeartbeatAt <= LEADER_HEARTBEAT_TTL_MS;
  }
  setLeader(tabId, heartbeatAt = Date.now()) {
    const previous = this._leaderTabId;
    this._leaderTabId = tabId;
    this.leaderHeartbeatAt = heartbeatAt;
    if (previous && previous !== tabId) {
      this.disposeLeaderBridge();
    }
  }
  clearLeader() {
    this._leaderTabId = void 0;
    this.leaderHeartbeatAt = 0;
  }
  onLeaderClaim(claimer, heartbeatAt) {
    const at = heartbeatAt ?? Date.now();
    if (!this.isLeaderFresh() || claimer < (this._leaderTabId ?? "")) {
      this.setLeader(claimer, at);
      return;
    }
    if (this._leaderTabId === claimer) {
      this.leaderHeartbeatAt = at;
    }
  }
  initLifecycleListeners() {
    self.addEventListener("install", (e) => {
      if (DEBUG) {
        console.log("ServiceWorker installed");
      }
      e.waitUntil(self.skipWaiting());
    });
    self.addEventListener("activate", (e) => {
      if (DEBUG) {
        console.log("ServiceWorker activated");
      }
      e.waitUntil(
        Promise.race([
          sleep(ACTIVATE_TIMEOUT),
          Promise.all([this.fetchManager.clearAssetCache(), self.clients.claim()])
        ])
      );
    });
  }
  /**
   * Page messages: `bridge.init` (+ ports) only.
   * Progressive/download parts use worker-rpc `file.getPart` on the telegram bridge.
   */
  initBridgeMessageListener() {
    self.addEventListener("message", (event) => {
      const raw = event.data;
      if (!raw || typeof raw !== "object") {
        return;
      }
      if ("kind" in raw && raw.kind === BRIDGE_KIND_INIT) {
        if (DEBUG) {
          console.log("[SW] Received BRIDGE_KIND_INIT message:", raw);
        }
        this.acceptBridge(raw, event.ports?.[0]);
      }
    });
  }
  acceptBridge(message, port) {
    if (!port) {
      if (DEBUG) {
        console.warn("[SW] acceptBridge: Received bridge message without transferred port:", message);
      }
      return;
    }
    const link = getBridgeLink(message) ?? BRIDGE_LINK_SW_TELEGRAM;
    if (DEBUG) {
      console.log(`[SW] acceptBridge: Attaching RPC bridge for link "${link}"`);
    }
    this.attachRpcBridge(link, port);
    port.postMessage(BRIDGE_READY_MESSAGE);
  }
  attachRpcBridge(link, port) {
    port.start();
    if (link === BRIDGE_LINK_SW_TELEGRAM) {
      this.disposeTelegramBridge();
      const client2 = createWorkerClient(port);
      this.telegramSlot = { port, client: client2 };
      if (DEBUG) {
        console.log("[SW] attachRpcBridge: Telegram SharedWorker bridge connected successfully");
      }
      this.unsubTelegramNotifications = client2.on("messageNotification", (payload) => {
        void this.notifications.onTelegramMessageNotification(payload);
      });
      return;
    }
    this.disposeLeaderBridge();
    const client = createWorkerClient(port);
    this.leaderSlot = { port, client };
    if (DEBUG) {
      console.log("[SW] attachRpcBridge: Leader tab bridge connected successfully");
    }
  }
  disposeTelegramBridge() {
    this.unsubTelegramNotifications?.();
    this.unsubTelegramNotifications = void 0;
    if (!this.telegramSlot) return;
    try {
      this.telegramSlot.client.terminate();
    } catch {
    }
    this.telegramSlot = void 0;
  }
  disposeLeaderBridge() {
    if (!this.leaderSlot) return;
    try {
      this.leaderSlot.client.terminate();
    } catch {
    }
    this.leaderSlot = void 0;
  }
};

// src/index.ts
new TeleGenieServiceWorker().init();
//# sourceMappingURL=sw.js.map
