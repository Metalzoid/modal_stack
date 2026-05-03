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
 */
export class Orchestrator {
  #expectedPopstates = 0;

  /** @param {OrchestratorOptions} options */
  constructor({
    runtime,
    stackId,
    baseUrl,
    restoreFrom = null,
    maxDepth = null,
    maxDepthStrategy = "warn",
  }) {
    if (!runtime) throw new Error("runtime required");
    this.runtime = runtime;
    this.maxDepth = maxDepth;
    this.maxDepthStrategy = maxDepthStrategy;
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
    return this.runtime.fetchFragment(url);
  }

  closeAll() {
    return this.#dispatch(closeAll(this.state));
  }

  onPopstate({ historyState, locationHref }) {
    if (this.#expectedPopstates > 0) {
      this.#expectedPopstates -= 1;
      return Promise.resolve();
    }
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
