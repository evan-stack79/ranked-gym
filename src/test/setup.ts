Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

/** jsdom n’implémente pas matchMedia — requis par metal-fx / fx.ts et les hooks motion. */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

/** metal-fx sonde WebGL via canvas — jsdom n’a pas de contexte ; fallback sans bruit. */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return null
  } as typeof HTMLCanvasElement.prototype.getContext
}
