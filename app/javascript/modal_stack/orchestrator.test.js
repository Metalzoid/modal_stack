import { beforeEach, describe, expect, test } from "bun:test";
import { Orchestrator } from "./orchestrator.js";
import { snapshot } from "./state.js";

const STACK_ID = "stack-abc";
const BASE_URL = "/projects";

function recordingRuntime() {
  const calls = [];
  const handlerNames = [
    "showDialog",
    "lockScroll",
    "inertLayer",
    "mountLayer",
    "morphTopLayer",
    "unmountTopLayer",
    "unmountAllLayers",
    "closeDialog",
    "unlockScroll",
    "pushHistory",
    "replaceHistory",
    "historyBack",
    "rebuildFromSnapshot",
    "persistSnapshot",
    "clearSnapshot",
  ];
  const runtime = { _calls: calls };
  for (const name of handlerNames) {
    runtime[name] = (cmd) => {
      calls.push({ type: name, ...cmd });
    };
  }
  return runtime;
}

let runtime;
let orchestrator;

beforeEach(() => {
  runtime = recordingRuntime();
  orchestrator = new Orchestrator({
    runtime,
    stackId: STACK_ID,
    baseUrl: BASE_URL,
  });
});

describe("constructor", () => {
  test("requires runtime", () => {
    expect(() => new Orchestrator({ stackId: "x", baseUrl: "/" })).toThrow(
      /runtime required/,
    );
  });

  test("starts empty", () => {
    expect(orchestrator.layers).toEqual([]);
    expect(orchestrator.depth).toBe(0);
  });

  test("restoreFrom seeds state when valid", async () => {
    const seed = new Orchestrator({
      runtime,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await seed.push({ id: "L1", url: "/x" });
    const json = snapshot(seed.state);

    const restored = new Orchestrator({
      runtime: recordingRuntime(),
      stackId: STACK_ID,
      baseUrl: BASE_URL,
      restoreFrom: json,
    });
    expect(restored.depth).toBe(1);
    expect(restored.layers[0].id).toBe("L1");
  });

  test("restoreFrom is ignored when stackId mismatches", async () => {
    const seed = new Orchestrator({
      runtime,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await seed.push({ id: "L1", url: "/x" });
    const json = snapshot(seed.state);

    const restored = new Orchestrator({
      runtime: recordingRuntime(),
      stackId: "other",
      baseUrl: BASE_URL,
      restoreFrom: json,
    });
    expect(restored.depth).toBe(0);
  });
});

describe("push", () => {
  test("dispatches commands in order, persists snapshot last", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    const types = runtime._calls.map((c) => c.type);
    expect(types).toEqual([
      "mountLayer",
      "showDialog",
      "lockScroll",
      "pushHistory",
      "persistSnapshot",
    ]);
  });

  test("persistSnapshot receives serialized state", async () => {
    let captured = null;
    runtime.persistSnapshot = (json) => {
      captured = json;
    };
    await orchestrator.push({ id: "L1", url: "/x" });
    expect(typeof captured).toBe("string");
    const parsed = JSON.parse(captured);
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0].id).toBe("L1");
  });

  test("throws when runtime is missing a handler", async () => {
    delete runtime.mountLayer;
    await expect(orchestrator.push({ id: "L1", url: "/x" })).rejects.toThrow(
      /mountLayer/,
    );
  });
});

describe("pop", () => {
  test("guards the popstate that history.back triggers", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    await orchestrator.pop();

    const popCalls = runtime._calls.map((c) => c.type);
    expect(popCalls).toContain("historyBack");

    runtime._calls.length = 0;
    await orchestrator.onPopstate({
      historyState: null,
      locationHref: BASE_URL,
    });
    expect(runtime._calls).toEqual([]);
  });

  test("subsequent popstate (not from us) is processed normally", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    await orchestrator.pop();
    await orchestrator.onPopstate({
      historyState: null,
      locationHref: BASE_URL,
    });

    runtime._calls.length = 0;
    await orchestrator.push({ id: "L2", url: "/y" });
    runtime._calls.length = 0;
    await orchestrator.onPopstate({
      historyState: null,
      locationHref: BASE_URL,
    });

    const types = runtime._calls.map((c) => c.type);
    expect(types).toContain("closeDialog");
  });
});

describe("replaceTop", () => {
  test("default replaces history without consuming guard", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    runtime._calls.length = 0;

    await orchestrator.replaceTop({ url: "/x/y" });
    const types = runtime._calls.map((c) => c.type);
    expect(types).toEqual([
      "morphTopLayer",
      "replaceHistory",
      "persistSnapshot",
    ]);
  });

  test("historyMode push emits pushHistory and updates layer id", async () => {
    await orchestrator.push({ id: "L1", url: "/wizard/1" });
    runtime._calls.length = 0;

    await orchestrator.replaceTop(
      { id: "L1b", url: "/wizard/2" },
      { historyMode: "push" },
    );

    const types = runtime._calls.map((c) => c.type);
    expect(types).toEqual([
      "morphTopLayer",
      "pushHistory",
      "persistSnapshot",
    ]);
    expect(orchestrator.layers[0].id).toBe("L1b");
  });
});

describe("closeAll", () => {
  test("clears layers and increments guard once for the historyBack call", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    await orchestrator.push({ id: "L2", url: "/y" });
    runtime._calls.length = 0;

    await orchestrator.closeAll();
    expect(orchestrator.depth).toBe(0);
    const types = runtime._calls.map((c) => c.type);
    expect(types).toEqual([
      "unmountAllLayers",
      "closeDialog",
      "unlockScroll",
      "historyBack",
      "clearSnapshot",
    ]);

    runtime._calls.length = 0;
    await orchestrator.onPopstate({
      historyState: null,
      locationHref: BASE_URL,
    });
    expect(runtime._calls).toEqual([]);
  });
});

describe("prefetch cache + abort", () => {
  // Each fakeFragment supports cloneNode so the orchestrator can hand out
  // independent copies without exhausting the cached entry.
  function fakeFragment(label) {
    return {
      label,
      consumed: false,
      cloneNode() {
        return fakeFragment(label);
      },
    };
  }

  function fetchingRuntime({ delayMs = 0, fail = false } = {}) {
    const calls = [];
    const aborts = [];
    const handlerNames = [
      "showDialog",
      "lockScroll",
      "inertLayer",
      "mountLayer",
      "morphTopLayer",
      "unmountTopLayer",
      "unmountAllLayers",
      "closeDialog",
      "unlockScroll",
      "pushHistory",
      "replaceHistory",
      "historyBack",
      "rebuildFromSnapshot",
      "persistSnapshot",
      "clearSnapshot",
    ];
    const runtime = { _calls: calls, _fetches: [], _aborts: aborts };
    for (const name of handlerNames) {
      runtime[name] = (cmd) => {
        calls.push({ type: name, ...cmd });
      };
    }
    runtime.fetchFragment = (url, { signal } = {}) => {
      runtime._fetches.push(url);
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          if (fail) reject(new Error("boom"));
          else resolve(fakeFragment(`frag:${url}`));
        }, delayMs);
        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            aborts.push(url);
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    };
    return runtime;
  }

  test("dedupes concurrent prefetches for the same url", async () => {
    const rt = fetchingRuntime({ delayMs: 5 });
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await Promise.all([
      orch.push({ id: "L1", url: "/x" }),
      orch.push({ id: "L2", url: "/x" }),
    ]);
    expect(rt._fetches).toEqual(["/x"]);
  });

  test("hits the cache on a second push to the same url", async () => {
    const rt = fetchingRuntime();
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await orch.push({ id: "L1", url: "/x" });
    await orch.pop();
    await orch.push({ id: "L2", url: "/x" });
    expect(rt._fetches).toEqual(["/x"]);
  });

  test("returns a fresh clone per consumer (cache survives consumption)", async () => {
    const rt = fetchingRuntime();
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    const seenFragments = [];
    rt.mountLayer = (cmd) => {
      seenFragments.push(cmd.fragment);
    };
    await orch.push({ id: "L1", url: "/x" });
    await orch.pop();
    await orch.push({ id: "L2", url: "/x" });
    expect(seenFragments).toHaveLength(2);
    expect(seenFragments[0]).not.toBe(seenFragments[1]);
  });

  test("TTL expires the cache and triggers a refetch", async () => {
    const rt = fetchingRuntime();
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
      prefetchTtlMs: 1,
    });
    await orch.push({ id: "L1", url: "/x" });
    await orch.pop();
    await new Promise((r) => setTimeout(r, 5));
    await orch.push({ id: "L2", url: "/x" });
    expect(rt._fetches).toEqual(["/x", "/x"]);
  });

  test("prefetch warms the cache without dispatching commands", async () => {
    const rt = fetchingRuntime();
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await orch.prefetch("/x");
    expect(rt._fetches).toEqual(["/x"]);
    expect(rt._calls).toEqual([]);
    // Subsequent push consumes the cache, no second fetch.
    await orch.push({ id: "L1", url: "/x" });
    expect(rt._fetches).toEqual(["/x"]);
  });

  test("prefetch swallows errors (best-effort)", async () => {
    const rt = fetchingRuntime({ fail: true });
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    await expect(orch.prefetch("/boom")).resolves.toBeNull();
  });

  test("closeAll aborts in-flight prefetches and clears the cache", async () => {
    const rt = fetchingRuntime({ delayMs: 50 });
    const orch = new Orchestrator({
      runtime: rt,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    // First push completes so the cache has /x.
    await orch.push({ id: "L1", url: "/x" });
    // Second push starts fetching /y and stays in flight.
    const inflight = orch.push({ id: "L2", url: "/y" });
    await new Promise((r) => setTimeout(r, 5));
    await orch.closeAll();
    await expect(inflight).rejects.toThrow(/aborted/);
    expect(rt._aborts).toContain("/y");
    // Cache has been cleared too: re-push of /x must refetch.
    await orch.push({ id: "L3", url: "/x" });
    expect(rt._fetches.filter((u) => u === "/x")).toHaveLength(2);
  });
});

describe("onPopstate", () => {
  test("forward navigation requests rebuild from snapshot", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    runtime._calls.length = 0;

    await orchestrator.onPopstate({
      historyState: { stackId: STACK_ID, layerId: "L2", depth: 2 },
      locationHref: "/y",
    });

    const rebuild = runtime._calls.find((c) => c.type === "rebuildFromSnapshot");
    expect(rebuild).toMatchObject({ targetDepth: 2, targetLayerId: "L2" });
  });

  test("missing handler error names known handlers", async () => {
    const partialRuntime = {
      // showDialog is missing on purpose so we can verify the error message.
      mountLayer: () => {},
      lockScroll: () => {},
      pushHistory: () => {},
      persistSnapshot: () => {},
    };
    Object.setPrototypeOf(partialRuntime, {
      mountLayer: partialRuntime.mountLayer,
      lockScroll: partialRuntime.lockScroll,
      pushHistory: partialRuntime.pushHistory,
      persistSnapshot: partialRuntime.persistSnapshot,
    });
    const orch = new Orchestrator({
      runtime: partialRuntime,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    let caught = null;
    try {
      await orch.push({ id: "L1", url: "/x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toMatch(/showDialog/);
    expect(caught.message).toMatch(/depth=/);
  });

  test("max_depth strategy is threaded through to the reducer", async () => {
    const orch = new Orchestrator({
      runtime: recordingRuntime(),
      stackId: STACK_ID,
      baseUrl: BASE_URL,
      maxDepth: 1,
      maxDepthStrategy: "raise",
    });
    await orch.push({ id: "L1", url: "/x" });
    let caught = null;
    try {
      await orch.push({ id: "L2", url: "/y" });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(caught.name).toBe("ModalStackDepthError");
    expect(orch.depth).toBe(1);
  });

  test("popstate from a different stack tears down without history changes", async () => {
    await orchestrator.push({ id: "L1", url: "/x" });
    runtime._calls.length = 0;

    await orchestrator.onPopstate({
      historyState: { stackId: "other", layerId: "Z", depth: 9 },
      locationHref: "/elsewhere",
    });

    const types = runtime._calls.map((c) => c.type);
    expect(types).toEqual([
      "unmountAllLayers",
      "closeDialog",
      "unlockScroll",
      "clearSnapshot",
    ]);
    expect(types).not.toContain("historyBack");
  });
});

