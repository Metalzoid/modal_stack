import { describe, expect, test } from "bun:test";
import { BrowserRuntime, FRAGMENT_HEADER, SNAPSHOT_KEY } from "./runtime.js";

function fakeStore() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

function noopRuntimeArgs(overrides = {}) {
  return {
    dialog: {},
    fetcher: () => Promise.resolve(new Response("")),
    documentRef: {},
    ...overrides,
  };
}

describe("BrowserRuntime constructor", () => {
  test("requires dialog", () => {
    expect(() => new BrowserRuntime(noopRuntimeArgs({ dialog: null }))).toThrow(
      /dialog/,
    );
  });

  test("requires fetcher", () => {
    expect(
      () => new BrowserRuntime(noopRuntimeArgs({ fetcher: null })),
    ).toThrow(/fetch/);
  });

  test("requires document", () => {
    expect(
      () => new BrowserRuntime(noopRuntimeArgs({ documentRef: null })),
    ).toThrow(/document/);
  });
});

describe("snapshot storage", () => {
  test("persistSnapshot writes under SNAPSHOT_KEY", () => {
    const store = fakeStore();
    const rt = new BrowserRuntime(noopRuntimeArgs({ store }));
    rt.persistSnapshot('{"hello":1}');
    expect(store.map.get(SNAPSHOT_KEY)).toBe('{"hello":1}');
  });

  test("clearSnapshot removes the key", () => {
    const store = fakeStore();
    store.map.set(SNAPSHOT_KEY, "x");
    const rt = new BrowserRuntime(noopRuntimeArgs({ store }));
    rt.clearSnapshot();
    expect(store.map.has(SNAPSHOT_KEY)).toBe(false);
  });

  test("readSnapshot returns the stored value or null", () => {
    const store = fakeStore();
    const rt = new BrowserRuntime(noopRuntimeArgs({ store }));
    expect(rt.readSnapshot()).toBeNull();
    store.map.set(SNAPSHOT_KEY, "{}");
    expect(rt.readSnapshot()).toBe("{}");
  });

  test("storage failures are swallowed (best-effort)", () => {
    const failing = {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
    };
    const rt = new BrowserRuntime(noopRuntimeArgs({ store: failing }));
    expect(() => rt.persistSnapshot("x")).not.toThrow();
    expect(() => rt.clearSnapshot()).not.toThrow();
    expect(rt.readSnapshot()).toBeNull();
  });

  test("operates as a no-op when no store is provided", () => {
    const rt = new BrowserRuntime(noopRuntimeArgs({ store: null }));
    expect(() => rt.persistSnapshot("x")).not.toThrow();
    expect(() => rt.clearSnapshot()).not.toThrow();
    expect(rt.readSnapshot()).toBeNull();
  });
});

describe("history wiring", () => {
  test("pushHistory / replaceHistory / historyBack delegate to history", () => {
    const calls = [];
    const history = {
      pushState: (s, t, u) => calls.push(["push", s, t, u]),
      replaceState: (s, t, u) => calls.push(["replace", s, t, u]),
      go: (n) => calls.push(["go", n]),
    };
    const rt = new BrowserRuntime(noopRuntimeArgs({ history }));
    rt.pushHistory({ url: "/a", historyState: { x: 1 } });
    rt.replaceHistory({ url: "/b", historyState: { y: 2 } });
    rt.historyBack({ n: 3 });
    expect(calls).toEqual([
      ["push", { x: 1 }, "", "/a"],
      ["replace", { y: 2 }, "", "/b"],
      ["go", -3],
    ]);
  });
});

describe("fetch headers", () => {
  test("sends Accept and X-Modal-Stack-Request headers", async () => {
    let captured = null;
    const fetcher = (url, opts) => {
      captured = { url, opts };
      return Promise.resolve(new Response("", { status: 500 }));
    };
    const rt = new BrowserRuntime(noopRuntimeArgs({ fetcher }));
    await expect(
      rt.mountLayer({
        layerId: "L",
        url: "/x",
        depth: 1,
        variant: "modal",
        dismissible: true,
      }),
    ).rejects.toThrow(/500/);
    expect(captured.opts.headers[FRAGMENT_HEADER]).toBe("1");
    expect(captured.opts.headers.Accept).toContain("text/html");
    expect(captured.opts.credentials).toBe("same-origin");
  });
});
