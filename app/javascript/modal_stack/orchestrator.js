import {
  closeAll,
  createStack,
  handlePopstate,
  pop,
  push,
  replaceTop,
  restore,
  snapshot,
} from "./state.js";

// How long a successful prefetch is reused before being refetched. Short
// enough that stale server-rendered HTML doesn't linger; long enough to
// absorb back/forward bounces and rapid double-clicks.
const PREFETCH_TTL_MS = 30_000;

/**
 * Owns the current `Stack`, calls the pure reducer, and executes the emitted
 * commands against an injected runtime. The only stateful piece is
 * `#expectedPopstates`, which lets us avoid re-entering the reducer when our
 * own `historyBack` calls fire `popstate`.
 *
 * @typedef {Object} OrchestratorOptions
 * @property {object} runtime         Instance with one method per command type
 * @property {string} stackId
 * @property {string} baseUrl
 * @property {string|null} [restoreFrom]   Serialized snapshot from sessionStorage
 * @property {number|null} [maxDepth]      null disables the cap
 * @property {"raise"|"warn"|"silent"} [maxDepthStrategy]
 * @property {number} [prefetchTtlMs]      Override the prefetch cache TTL (testing)
 */
export class Orchestrator {
  #expectedPopstates = 0;
  // url → { fragment, ts }. Fragment is the canonical copy; consumers
  // always receive a `cloneNode(true)` so the cached entry stays intact.
  #fragmentCache = new Map();
  // url → { controller, promise }. Lets concurrent prefetches dedupe onto
  // the same in-flight request, and gives `closeAll` a way to cancel them.
  #inflight = new Map();

  /** @param {OrchestratorOptions} options */
  constructor({
    runtime,
    stackId,
    baseUrl,
    restoreFrom = null,
    maxDepth = null,
    maxDepthStrategy = "warn",
    prefetchTtlMs = PREFETCH_TTL_MS,
  }) {
    if (!runtime) throw new Error("runtime required");
    this.runtime = runtime;
    this.maxDepth = maxDepth;
    this.maxDepthStrategy = maxDepthStrategy;
    this.prefetchTtlMs = prefetchTtlMs;
    this.state = createStack({ stackId, baseUrl });

    if (restoreFrom) {
      const restored = restore(restoreFrom, { stackId });
      if (restored) this.state = restored;
    }
  }

  get layers() {
    return this.state.layers;
  }

  get depth() {
    return this.state.layers.length;
  }

  /**
   * Push a layer. When `html`/`fragment` are absent, the orchestrator
   * pre-fetches the URL so `mountLayer` is a sync DOM append (no flash).
   * @param {Partial<import("./state.js").Layer> & { id: string, url: string }} layer
   * @param {{ html?: string|null, fragment?: DocumentFragment|null }} [options]
   */
  async push(layer, { html = null, fragment = null } = {}) {
    const transition = push(this.state, layer, {
      maxDepth: this.maxDepth,
      maxDepthStrategy: this.maxDepthStrategy,
    });
    if (transition.commands.length === 0) return;

    if (fragment == null && html == null && layer?.url) {
      fragment = await this.#prefetch(layer.url);
    }
    return this.#dispatch(transition, { html, fragment });
  }

  pop() {
    return this.#dispatch(pop(this.state));
  }

  /**
   * Replace (morph) the top layer.
   * @param {Partial<import("./state.js").Layer>} patch
   * @param {{ html?: string|null, fragment?: DocumentFragment|null, historyMode?: "push"|"replace" }} [options]
   */
  async replaceTop(patch, { html = null, fragment = null, ...opts } = {}) {
    if (fragment == null && html == null && patch?.url) {
      fragment = await this.#prefetch(patch.url);
    }
    return this.#dispatch(replaceTop(this.state, patch, opts), { html, fragment });
  }

  async #prefetch(url) {
    if (typeof this.runtime.fetchFragment !== "function") return null;

    const cached = this.#fragmentCache.get(url);
    if (cached && Date.now() - cached.ts < this.prefetchTtlMs) {
      return cloneFragment(cached.fragment);
    }

    const existing = this.#inflight.get(url);
    if (existing) {
      const entry = await existing.promise;
      return cloneFragment(entry.fragment);
    }

    const controller = supportsAbort() ? new AbortController() : null;
    const fetchPromise = this.runtime
      .fetchFragment(url, controller ? { signal: controller.signal } : undefined)
      .then((fragment) => {
        const entry = { fragment, ts: Date.now() };
        this.#fragmentCache.set(url, entry);
        return entry;
      })
      .finally(() => {
        this.#inflight.delete(url);
      });

    this.#inflight.set(url, { controller, promise: fetchPromise });
    const entry = await fetchPromise;
    return cloneFragment(entry.fragment);
  }

  // Aborts every in-flight prefetch and forgets any cached fragments.
  // Called when we tear the stack down (closeAll / cross-stack popstate)
  // because the URLs in flight are no longer relevant. In-flight callers
  // see an AbortError; caller code (controllers) already wraps push/pop
  // in try/catch via `guarded()`.
  #invalidatePrefetch() {
    for (const { controller } of this.#inflight.values()) {
      try {
        controller?.abort();
      } catch {
        // ignore — abort is best-effort
      }
    }
    this.#inflight.clear();
    this.#fragmentCache.clear();
  }

  // Warm the prefetch cache for `url` without mutating the stack. Safe
  // to call repeatedly for the same URL (deduped via #inflight) and from
  // hover/focus handlers; failures are swallowed since this is best-effort.
  prefetch(url) {
    if (!url || typeof this.runtime.fetchFragment !== "function") {
      return Promise.resolve(null);
    }
    return this.#prefetch(url).catch(() => null);
  }

  closeAll() {
    this.#invalidatePrefetch();
    return this.#dispatch(closeAll(this.state));
  }

  onPopstate({ historyState, locationHref }) {
    if (this.#expectedPopstates > 0) {
      this.#expectedPopstates -= 1;
      return Promise.resolve();
    }
    // A popstate arriving while we have prefetches in flight means the
    // user navigated away from any URL we were preloading; drop them.
    this.#invalidatePrefetch();
    return this.#dispatch(
      handlePopstate(this.state, { historyState, locationHref }),
    );
  }

  async #dispatch({ state, commands }, payload = {}) {
    this.state = state;
    for (const cmd of commands) {
      if (cmd.type === "mountLayer" || cmd.type === "morphTopLayer") {
        if (payload.html != null) cmd.html = payload.html;
        if (payload.fragment != null) cmd.fragment = payload.fragment;
      }
      await this.#execute(cmd);
    }
  }

  async #execute(cmd) {
    if (cmd.type === "historyBack") {
      this.#expectedPopstates += 1;
    }

    if (cmd.type === "persistSnapshot") {
      await this.runtime.persistSnapshot?.(snapshot(this.state));
      return;
    }

    const handler = this.runtime[cmd.type];
    if (typeof handler !== "function") {
      const known = Object.getOwnPropertyNames(Object.getPrototypeOf(this.runtime))
        .filter((name) => name !== "constructor" && typeof this.runtime[name] === "function")
        .sort()
        .join(", ");
      throw new Error(
        `[modal_stack] runtime missing handler for "${cmd.type}" ` +
          `(stack depth=${this.depth}). ` +
          `Known handlers: ${known || "<none>"}.`,
      );
    }
    await handler.call(this.runtime, cmd);
  }
}

function cloneFragment(fragment) {
  if (!fragment) return fragment;
  if (typeof fragment.cloneNode === "function") {
    return fragment.cloneNode(true);
  }
  return fragment;
}

function supportsAbort() {
  return typeof globalThis.AbortController === "function";
}
