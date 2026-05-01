export const VARIANTS = Object.freeze([
  "modal",
  "drawer",
  "bottom_sheet",
  "confirmation",
]);

const SNAPSHOT_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;
const DRAWER_SIDES = Object.freeze(["left", "right", "top", "bottom"]);

function normalizeLayerOptions({ variant, size, side, width, height }) {
  // A drawer must always carry a side so CSS can position it.
  const normalizedSide = variant === "drawer" ? (side ?? "right") : (side ?? null);
  if (variant === "drawer" && !DRAWER_SIDES.includes(normalizedSide)) {
    throw new Error(`unknown drawer side: ${normalizedSide}`);
  }
  return {
    size: size ?? null,
    side: normalizedSide,
    width: width ?? null,
    height: height ?? null,
  };
}

function freezeLayer({ id, url, variant, dismissible, size, side, width, height }) {
  const normalized = normalizeLayerOptions({ variant, size, side, width, height });
  return Object.freeze({
    id,
    url,
    variant,
    dismissible: !!dismissible,
    size: normalized.size,
    side: normalized.side,
    width: normalized.width,
    height: normalized.height,
  });
}

export function createStack({ stackId, baseUrl }) {
  if (!stackId) throw new Error("stackId required");
  if (!baseUrl) throw new Error("baseUrl required");
  return Object.freeze({ stackId, baseUrl, layers: Object.freeze([]) });
}

export function topLayer(state) {
  return state.layers[state.layers.length - 1] ?? null;
}

export function push(state, layer) {
  if (!layer?.id) throw new Error("layer.id required");
  if (!layer?.url) throw new Error("layer.url required");
  const variant = layer.variant ?? "modal";
  if (!VARIANTS.includes(variant)) {
    throw new Error(`unknown variant: ${variant}`);
  }

  const newLayer = freezeLayer({
    id: layer.id,
    url: layer.url,
    variant,
    dismissible: layer.dismissible ?? true,
    size: layer.size,
    side: layer.side,
    width: layer.width,
    height: layer.height,
  });
  const previousTop = topLayer(state);
  const layers = Object.freeze([...state.layers, newLayer]);
  const depth = layers.length;

  // mountLayer runs first so the dialog (or the previous layer) doesn't
  // flash an empty / interactive intermediate state while we're still
  // loading the new content.  When the orchestrator has pre-fetched the
  // fragment, mountLayer is a sync DOM append.
  const commands = [];
  commands.push({
    type: "mountLayer",
    layerId: newLayer.id,
    url: newLayer.url,
    depth,
    variant: newLayer.variant,
    dismissible: newLayer.dismissible,
    ...(newLayer.size ? { size: newLayer.size } : {}),
    ...(newLayer.side ? { side: newLayer.side } : {}),
    ...(newLayer.width ? { width: newLayer.width } : {}),
    ...(newLayer.height ? { height: newLayer.height } : {}),
  });
  if (depth === 1) {
    commands.push({ type: "showDialog" });
    commands.push({ type: "lockScroll" });
  } else {
    commands.push({ type: "inertLayer", layerId: previousTop.id, value: true });
  }
  commands.push({
    type: "pushHistory",
    url: newLayer.url,
    historyState: { stackId: state.stackId, layerId: newLayer.id, depth },
  });
  commands.push({ type: "persistSnapshot" });

  return { state: { ...state, layers }, commands };
}

export function pop(state) {
  if (state.layers.length === 0) return { state, commands: [] };

  const newLayers = Object.freeze(state.layers.slice(0, -1));
  const newTop = newLayers[newLayers.length - 1] ?? null;
  const commands = [
    { type: "unmountTopLayer" },
    { type: "historyBack", n: 1 },
  ];
  if (newTop) {
    commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
    commands.push({ type: "persistSnapshot" });
  } else {
    commands.push({ type: "closeDialog" });
    commands.push({ type: "unlockScroll" });
    commands.push({ type: "clearSnapshot" });
  }
  return { state: { ...state, layers: newLayers }, commands };
}

export function replaceTop(state, patch, { historyMode = "replace" } = {}) {
  if (state.layers.length === 0) {
    throw new Error("replaceTop requires at least one layer");
  }
  if (historyMode !== "push" && historyMode !== "replace") {
    throw new Error(`unknown historyMode: ${historyMode}`);
  }

  const top = topLayer(state);
  const next = freezeLayer({
    id: patch.id ?? top.id,
    url: patch.url ?? top.url,
    variant: patch.variant ?? top.variant,
    dismissible: patch.dismissible ?? top.dismissible,
    size: patch.size ?? top.size,
    side: patch.side ?? top.side,
    width: patch.width ?? top.width,
    height: patch.height ?? top.height,
  });
  const newLayers = Object.freeze([...state.layers.slice(0, -1), next]);
  const depth = newLayers.length;

  const historyCmd = {
    type: historyMode === "push" ? "pushHistory" : "replaceHistory",
    url: next.url,
    historyState: { stackId: state.stackId, layerId: next.id, depth },
  };

  return {
    state: { ...state, layers: newLayers },
    commands: [
      {
        type: "morphTopLayer",
        layerId: next.id,
        url: next.url,
        depth,
        variant: next.variant,
        dismissible: next.dismissible,
        ...(next.size ? { size: next.size } : {}),
        ...(next.side ? { side: next.side } : {}),
        ...(next.width ? { width: next.width } : {}),
        ...(next.height ? { height: next.height } : {}),
      },
      historyCmd,
      { type: "persistSnapshot" },
    ],
  };
}

export function closeAll(state) {
  if (state.layers.length === 0) return { state, commands: [] };
  const n = state.layers.length;
  return {
    state: { ...state, layers: Object.freeze([]) },
    commands: [
      { type: "unmountAllLayers" },
      { type: "closeDialog" },
      { type: "unlockScroll" },
      { type: "historyBack", n },
      { type: "clearSnapshot" },
    ],
  };
}

export function handlePopstate(state, { historyState, locationHref }) {
  const isOurs =
    historyState && historyState.stackId === state.stackId;

  if (!isOurs) {
    if (state.layers.length === 0) return { state, commands: [] };
    return {
      state: { ...state, layers: Object.freeze([]) },
      commands: [
        { type: "unmountAllLayers" },
        { type: "closeDialog" },
        { type: "unlockScroll" },
        { type: "clearSnapshot" },
      ],
    };
  }

  const targetDepth = historyState.depth ?? 0;
  const currentDepth = state.layers.length;
  const targetLayerId = historyState.layerId ?? null;

  if (targetDepth < currentDepth) {
    const newLayers = Object.freeze(state.layers.slice(0, targetDepth));
    const newTop = newLayers[newLayers.length - 1] ?? null;
    const commands = [];
    for (let i = 0; i < currentDepth - targetDepth; i++) {
      commands.push({ type: "unmountTopLayer" });
    }
    if (newTop) {
      commands.push({ type: "inertLayer", layerId: newTop.id, value: false });
      commands.push({ type: "persistSnapshot" });
    } else {
      commands.push({ type: "closeDialog" });
      commands.push({ type: "unlockScroll" });
      commands.push({ type: "clearSnapshot" });
    }
    return { state: { ...state, layers: newLayers }, commands };
  }

  if (targetDepth > currentDepth) {
    return {
      state,
      commands: [
        { type: "rebuildFromSnapshot", targetDepth, targetLayerId },
      ],
    };
  }

  const top = topLayer(state);
  if (top && targetLayerId && top.id !== targetLayerId) {
    const updatedTop = freezeLayer({
      id: targetLayerId,
      url: locationHref ?? top.url,
      variant: top.variant,
      dismissible: top.dismissible,
      size: top.size,
      side: top.side,
      width: top.width,
      height: top.height,
    });
    const newLayers = Object.freeze([
      ...state.layers.slice(0, -1),
      updatedTop,
    ]);
    return {
      state: { ...state, layers: newLayers },
      commands: [
        {
          type: "morphTopLayer",
          layerId: targetLayerId,
          url: updatedTop.url,
          depth: currentDepth,
          variant: updatedTop.variant,
          dismissible: updatedTop.dismissible,
          ...(updatedTop.size ? { size: updatedTop.size } : {}),
          ...(updatedTop.side ? { side: updatedTop.side } : {}),
          ...(updatedTop.width ? { width: updatedTop.width } : {}),
          ...(updatedTop.height ? { height: updatedTop.height } : {}),
        },
        { type: "persistSnapshot" },
      ],
    };
  }

  return { state, commands: [] };
}

export function snapshot(state, { now = Date.now } = {}) {
  return JSON.stringify({
    v: SNAPSHOT_VERSION,
    stackId: state.stackId,
    baseUrl: state.baseUrl,
    layers: state.layers,
    savedAt: now(),
  });
}

export function restore(
  serialized,
  { stackId, maxAgeMs = DEFAULT_MAX_AGE_MS, now = Date.now } = {},
) {
  if (typeof serialized !== "string" || serialized.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (parsed?.v !== SNAPSHOT_VERSION) return null;
  if (typeof parsed.stackId !== "string") return null;
  if (typeof parsed.baseUrl !== "string") return null;
  if (!Array.isArray(parsed.layers)) return null;
  if (typeof parsed.savedAt !== "number") return null;
  if (stackId && parsed.stackId !== stackId) return null;
  if (now() - parsed.savedAt > maxAgeMs) return null;

  for (const l of parsed.layers) {
    if (!l || typeof l.id !== "string" || typeof l.url !== "string") return null;
    if (!VARIANTS.includes(l.variant)) return null;
  }

  return Object.freeze({
    stackId: parsed.stackId,
    baseUrl: parsed.baseUrl,
    layers: Object.freeze(parsed.layers.map(freezeLayer)),
  });
}
