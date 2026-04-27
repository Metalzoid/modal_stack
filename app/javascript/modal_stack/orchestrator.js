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

export class Orchestrator {
  #expectedPopstates = 0;

  constructor({ runtime, stackId, baseUrl, restoreFrom = null }) {
    if (!runtime) throw new Error("runtime required");
    this.runtime = runtime;
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

  async push(layer, { html = null, fragment = null } = {}) {
    if (fragment == null && html == null && layer?.url) {
      fragment = await this.#prefetch(layer.url);
    }
    return this.#dispatch(push(this.state, layer), { html, fragment });
  }

  pop() {
    return this.#dispatch(pop(this.state));
  }

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
      throw new Error(`runtime missing handler for "${cmd.type}"`);
    }
    await handler.call(this.runtime, cmd);
  }
}
