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

  test("restoreFrom seeds state when valid", () => {
    const seed = new Orchestrator({
      runtime,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    seed.push({ id: "L1", url: "/x" });
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

  test("restoreFrom is ignored when stackId mismatches", () => {
    const seed = new Orchestrator({
      runtime,
      stackId: STACK_ID,
      baseUrl: BASE_URL,
    });
    seed.push({ id: "L1", url: "/x" });
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
      "showDialog",
      "lockScroll",
      "mountLayer",
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

