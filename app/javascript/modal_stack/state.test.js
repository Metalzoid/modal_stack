import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  closeAll,
  createStack,
  handlePopstate,
  ModalStackDepthError,
  pop,
  push,
  replaceTop,
  restore,
  snapshot,
  topLayer,
} from "./state.js";

const STACK_ID = "stack-abc";
const BASE_URL = "/projects";

function freshStack() {
  return createStack({ stackId: STACK_ID, baseUrl: BASE_URL });
}

function pushed(state, overrides = {}) {
  return push(state, {
    id: "L1",
    url: "/projects/42/edit",
    variant: "modal",
    dismissible: true,
    ...overrides,
  });
}

describe("createStack", () => {
  test("returns frozen empty stack", () => {
    const s = freshStack();
    expect(s.stackId).toBe(STACK_ID);
    expect(s.baseUrl).toBe(BASE_URL);
    expect(s.layers).toEqual([]);
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.layers)).toBe(true);
  });

  test("requires stackId and baseUrl", () => {
    expect(() => createStack({ baseUrl: "/" })).toThrow(/stackId/);
    expect(() => createStack({ stackId: "x" })).toThrow(/baseUrl/);
  });
});

describe("topLayer", () => {
  test("null when empty", () => {
    expect(topLayer(freshStack())).toBeNull();
  });

  test("returns the last layer", () => {
    const { state } = pushed(freshStack());
    expect(topLayer(state).id).toBe("L1");
  });
});

describe("push", () => {
  test("first layer emits showDialog + lockScroll + mount + pushHistory + snapshot", () => {
    const { state, commands } = pushed(freshStack());
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]).toMatchObject({
      id: "L1",
      url: "/projects/42/edit",
      variant: "modal",
      dismissible: true,
    });
    expect(commands).toEqual([
      {
        type: "mountLayer",
        layerId: "L1",
        url: "/projects/42/edit",
        depth: 1,
        variant: "modal",
        dismissible: true,
      },
      { type: "showDialog" },
      { type: "lockScroll" },
      {
        type: "pushHistory",
        url: "/projects/42/edit",
        historyState: { stackId: STACK_ID, layerId: "L1", depth: 1 },
      },
      { type: "persistSnapshot" },
    ]);
  });

  test("preserves side and size for drawer layers", () => {
    const { state, commands } = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
      side: "right",
      size: "md",
    });

    expect(state.layers[0]).toMatchObject({
      id: "L1",
      variant: "drawer",
      side: "right",
      size: "md",
    });
    expect(commands[0]).toMatchObject({
      type: "mountLayer",
      layerId: "L1",
      variant: "drawer",
      side: "right",
      size: "md",
    });
  });

  test("defaults drawer side to right when missing", () => {
    const { state, commands } = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
    });

    expect(state.layers[0]).toMatchObject({
      variant: "drawer",
      side: "right",
    });
    expect(commands[0]).toMatchObject({
      type: "mountLayer",
      variant: "drawer",
      side: "right",
    });
  });

  test("supports top and bottom drawer sides", () => {
    const topLayerResult = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
      side: "top",
    });
    expect(topLayerResult.state.layers[0].side).toBe("top");

    const bottomLayerResult = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
      side: "bottom",
    });
    expect(bottomLayerResult.state.layers[0].side).toBe("bottom");
  });

  test("rejects unknown drawer side", () => {
    expect(() =>
      push(freshStack(), {
        id: "L1",
        url: "/modal_stack/details",
        variant: "drawer",
        side: "middle",
      }),
    ).toThrow(/unknown drawer side/);
  });

  describe("max_depth", () => {
    let warnings = [];
    const originalWarn = console.warn;

    beforeEach(() => {
      warnings = [];
      console.warn = (...args) => warnings.push(args.join(" "));
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    function stackOfDepth(n) {
      let s = freshStack();
      for (let i = 0; i < n; i++) {
        s = push(s, { id: `L${i}`, url: `/p/${i}`, variant: "modal" }).state;
      }
      return s;
    }

    test("no cap when maxDepth is null (default)", () => {
      const s = stackOfDepth(10);
      const { state, commands } = push(s, { id: "L10", url: "/p/10", variant: "modal" });
      expect(state.layers).toHaveLength(11);
      expect(commands.length).toBeGreaterThan(0);
    });

    test("strategy 'warn' drops the push and logs", () => {
      const s = stackOfDepth(3);
      const { state, commands } = push(
        s,
        { id: "Lx", url: "/x", variant: "modal" },
        { maxDepth: 3, maxDepthStrategy: "warn" },
      );
      expect(state).toBe(s);
      expect(commands).toEqual([]);
      expect(warnings.join("\n")).toMatch(/max_depth=3/);
    });

    test("strategy 'silent' drops the push without warning", () => {
      const s = stackOfDepth(3);
      const { state, commands } = push(
        s,
        { id: "Lx", url: "/x", variant: "modal" },
        { maxDepth: 3, maxDepthStrategy: "silent" },
      );
      expect(state).toBe(s);
      expect(commands).toEqual([]);
      expect(warnings).toEqual([]);
    });

    test("strategy 'raise' throws ModalStackDepthError", () => {
      const s = stackOfDepth(3);
      let caught = null;
      try {
        push(
          s,
          { id: "Lx", url: "/x", variant: "modal" },
          { maxDepth: 3, maxDepthStrategy: "raise" },
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ModalStackDepthError);
      expect(caught.maxDepth).toBe(3);
      expect(caught.attemptedDepth).toBe(4);
    });

    test("rejects unknown strategy", () => {
      const s = stackOfDepth(3);
      expect(() =>
        push(
          s,
          { id: "Lx", url: "/x", variant: "modal" },
          { maxDepth: 3, maxDepthStrategy: "explode" },
        ),
      ).toThrow(/unknown maxDepthStrategy/);
    });
  });

  test("passes custom width and height to mount command", () => {
    const { state, commands } = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
      width: "80vw",
      height: "24rem",
    });
    expect(state.layers[0]).toMatchObject({
      width: "80vw",
      height: "24rem",
    });
    expect(commands[0]).toMatchObject({
      width: "80vw",
      height: "24rem",
    });
  });

  test("second layer mounts before inerting the previous top, no showDialog", () => {
    const first = pushed(freshStack()).state;
    const { state, commands } = push(first, { id: "L2", url: "/clients/new" });
    expect(state.layers).toHaveLength(2);
    expect(commands.map((c) => c.type)).toEqual([
      "mountLayer",
      "inertLayer",
      "pushHistory",
      "persistSnapshot",
    ]);
    expect(commands).not.toContainEqual({ type: "showDialog" });
    expect(commands).toContainEqual({
      type: "pushHistory",
      url: "/clients/new",
      historyState: { stackId: STACK_ID, layerId: "L2", depth: 2 },
    });
  });

  test("rejects unknown variant", () => {
    expect(() =>
      push(freshStack(), { id: "L1", url: "/x", variant: "popover" }),
    ).toThrow(/unknown variant/);
  });

  test("rejects missing id or url", () => {
    expect(() => push(freshStack(), { url: "/x" })).toThrow(/id/);
    expect(() => push(freshStack(), { id: "L" })).toThrow(/url/);
  });

  test("dismissible defaults to true", () => {
    const { state } = push(freshStack(), { id: "L1", url: "/x" });
    expect(state.layers[0].dismissible).toBe(true);
  });

  test("variant defaults to modal", () => {
    const { state } = push(freshStack(), { id: "L1", url: "/x" });
    expect(state.layers[0].variant).toBe("modal");
  });
});

describe("pop", () => {
  test("noop on empty stack", () => {
    const s = freshStack();
    expect(pop(s)).toEqual({ state: s, commands: [] });
  });

  test("popping last layer closes dialog and clears snapshot", () => {
    const first = pushed(freshStack()).state;
    const { state, commands } = pop(first);
    expect(state.layers).toEqual([]);
    expect(commands).toEqual([
      { type: "unmountTopLayer" },
      { type: "historyBack", n: 1 },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "clearSnapshot" },
    ]);
  });

  test("popping middle layer un-inerts new top", () => {
    let s = pushed(freshStack()).state;
    s = push(s, { id: "L2", url: "/clients/new" }).state;
    const { state, commands } = pop(s);
    expect(state.layers).toHaveLength(1);
    expect(commands).toEqual([
      { type: "unmountTopLayer" },
      { type: "historyBack", n: 1 },
      { type: "inertLayer", layerId: "L1", value: false },
      { type: "persistSnapshot" },
    ]);
  });
});

describe("replaceTop", () => {
  test("throws on empty stack", () => {
    expect(() => replaceTop(freshStack(), { url: "/x" })).toThrow(
      /at least one layer/,
    );
  });

  test("default historyMode is replace, keeps id", () => {
    const first = pushed(freshStack()).state;
    const { state, commands } = replaceTop(first, { url: "/projects/42/edit/billing" });
    expect(state.layers[0].id).toBe("L1");
    expect(state.layers[0].url).toBe("/projects/42/edit/billing");
    expect(commands).toEqual([
      {
        type: "morphTopLayer",
        layerId: "L1",
        url: "/projects/42/edit/billing",
        depth: 1,
        variant: "modal",
        dismissible: true,
      },
      {
        type: "replaceHistory",
        url: "/projects/42/edit/billing",
        historyState: { stackId: STACK_ID, layerId: "L1", depth: 1 },
      },
      { type: "persistSnapshot" },
    ]);
  });

  test("replaceTop keeps side and size when not patched", () => {
    const first = push(freshStack(), {
      id: "L1",
      url: "/modal_stack/details",
      variant: "drawer",
      side: "right",
      size: "md",
    }).state;

    const { state, commands } = replaceTop(first, { url: "/modal_stack/details?x=1" });

    expect(state.layers[0]).toMatchObject({
      id: "L1",
      variant: "drawer",
      side: "right",
      size: "md",
      url: "/modal_stack/details?x=1",
    });
    expect(commands[0]).toMatchObject({
      type: "morphTopLayer",
      layerId: "L1",
      variant: "drawer",
      side: "right",
      size: "md",
      url: "/modal_stack/details?x=1",
    });
  });

  test("historyMode push assigns a new layerId", () => {
    const first = pushed(freshStack()).state;
    const { state, commands } = replaceTop(
      first,
      { id: "L1b", url: "/onboarding/step2" },
      { historyMode: "push" },
    );
    expect(state.layers[0].id).toBe("L1b");
    expect(commands[1]).toEqual({
      type: "pushHistory",
      url: "/onboarding/step2",
      historyState: { stackId: STACK_ID, layerId: "L1b", depth: 1 },
    });
  });

  test("rejects unknown historyMode", () => {
    const s = pushed(freshStack()).state;
    expect(() => replaceTop(s, { url: "/x" }, { historyMode: "wat" })).toThrow(
      /historyMode/,
    );
  });
});

describe("closeAll", () => {
  test("noop on empty stack", () => {
    const s = freshStack();
    expect(closeAll(s)).toEqual({ state: s, commands: [] });
  });

  test("clears layers and walks history back N entries", () => {
    let s = pushed(freshStack()).state;
    s = push(s, { id: "L2", url: "/clients/new" }).state;
    s = push(s, { id: "L3", url: "/clients/new/contact" }).state;
    const { state, commands } = closeAll(s);
    expect(state.layers).toEqual([]);
    expect(commands).toEqual([
      { type: "unmountAllLayers" },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "historyBack", n: 3 },
      { type: "clearSnapshot" },
    ]);
  });
});

describe("handlePopstate", () => {
  function buildTwoLayer() {
    let s = pushed(freshStack()).state;
    s = push(s, { id: "L2", url: "/clients/new" }).state;
    return s;
  }

  test("ignores popstate from a different stackId, tearing down silently", () => {
    const s = buildTwoLayer();
    const { state, commands } = handlePopstate(s, {
      historyState: { stackId: "other-stack", layerId: "X", depth: 5 },
      locationHref: "/elsewhere",
    });
    expect(state.layers).toEqual([]);
    expect(commands).toEqual([
      { type: "unmountAllLayers" },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "clearSnapshot" },
    ]);
  });

  test("popstate with no historyState while empty is a true noop", () => {
    const s = freshStack();
    expect(handlePopstate(s, { historyState: null })).toEqual({
      state: s,
      commands: [],
    });
  });

  test("back: targetDepth < current pops layers and un-inerts new top (no historyBack)", () => {
    const s = buildTwoLayer();
    const { state, commands } = handlePopstate(s, {
      historyState: { stackId: STACK_ID, layerId: "L1", depth: 1 },
      locationHref: "/projects/42/edit",
    });
    expect(state.layers.map((l) => l.id)).toEqual(["L1"]);
    expect(commands).toEqual([
      { type: "unmountTopLayer" },
      { type: "inertLayer", layerId: "L1", value: false },
      { type: "persistSnapshot" },
    ]);
    expect(commands).not.toContainEqual({ type: "historyBack", n: 1 });
  });

  test("back: targetDepth 0 closes dialog and clears snapshot", () => {
    const s = buildTwoLayer();
    const { state, commands } = handlePopstate(s, {
      historyState: { stackId: STACK_ID, depth: 0 },
      locationHref: BASE_URL,
    });
    expect(state.layers).toEqual([]);
    expect(commands).toEqual([
      { type: "unmountTopLayer" },
      { type: "unmountTopLayer" },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "clearSnapshot" },
    ]);
  });

  test("forward: targetDepth > current asks controller to rebuild from snapshot", () => {
    const s = pushed(freshStack()).state;
    const { state, commands } = handlePopstate(s, {
      historyState: { stackId: STACK_ID, layerId: "L2", depth: 2 },
      locationHref: "/clients/new",
    });
    expect(state).toEqual(s);
    expect(commands).toEqual([
      { type: "rebuildFromSnapshot", targetDepth: 2, targetLayerId: "L2" },
    ]);
  });

  test("same depth, different layerId morphs top (wizard step back)", () => {
    const after = replaceTop(
      pushed(freshStack()).state,
      { id: "L1b", url: "/onboarding/step2" },
      { historyMode: "push" },
    ).state;
    const { state, commands } = handlePopstate(after, {
      historyState: { stackId: STACK_ID, layerId: "L1", depth: 1 },
      locationHref: "/onboarding/step1",
    });
    expect(state.layers[0]).toMatchObject({
      id: "L1",
      url: "/onboarding/step1",
    });
    expect(commands).toEqual([
      {
        type: "morphTopLayer",
        layerId: "L1",
        url: "/onboarding/step1",
        depth: 1,
        variant: "modal",
        dismissible: true,
      },
      { type: "persistSnapshot" },
    ]);
  });

  test("same depth, same layerId is a noop", () => {
    const s = pushed(freshStack()).state;
    const { state, commands } = handlePopstate(s, {
      historyState: { stackId: STACK_ID, layerId: "L1", depth: 1 },
      locationHref: "/projects/42/edit",
    });
    expect(state).toEqual(s);
    expect(commands).toEqual([]);
  });
});

describe("snapshot / restore", () => {
  test("round-trips state", () => {
    let s = pushed(freshStack()).state;
    s = push(s, { id: "L2", url: "/clients/new", variant: "drawer" }).state;
    const json = snapshot(s);
    const restored = restore(json, { stackId: STACK_ID });
    expect(restored).toEqual(s);
  });

  test("returns null for wrong stackId", () => {
    const s = pushed(freshStack()).state;
    const json = snapshot(s);
    expect(restore(json, { stackId: "other" })).toBeNull();
  });

  test("returns null when expired", () => {
    const s = pushed(freshStack()).state;
    const json = snapshot(s, { now: () => 0 });
    const restored = restore(json, {
      stackId: STACK_ID,
      maxAgeMs: 1000,
      now: () => 5000,
    });
    expect(restored).toBeNull();
  });

  test("returns null on corrupt payload", () => {
    expect(restore("not-json", { stackId: STACK_ID })).toBeNull();
    expect(restore("", { stackId: STACK_ID })).toBeNull();
    expect(restore(null, { stackId: STACK_ID })).toBeNull();
    expect(restore('{"v":2}', { stackId: STACK_ID })).toBeNull();
    expect(restore('{"v":1}', { stackId: STACK_ID })).toBeNull();
  });

  test("returns null when a layer has unknown variant", () => {
    const malicious = JSON.stringify({
      v: 1,
      stackId: STACK_ID,
      baseUrl: "/",
      layers: [{ id: "L1", url: "/", variant: "popover", dismissible: true }],
      savedAt: Date.now(),
    });
    expect(restore(malicious, { stackId: STACK_ID })).toBeNull();
  });
});
