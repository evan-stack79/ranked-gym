'use client';
/**
 * The React side of the dissolve web components, from dissolve (dissolve-ui). This file is yours.
 * Each component is a framework free core (<name>.core.ts) that owns its DOM; this hook mounts it
 * on a host element and keeps it in sync with the React props.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** What every core returns: the component, live. */
export type DissolveInstance<P> = {
  /** Applies changed props. An undefined value puts the default back. */
  update: (props: Partial<P>) => void;
  /** Stops every listener, frame and timer, and removes what the core added to the host. */
  destroy: () => void;
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Creates the core on mount, passes the props on every render (props removed since the last
 * render go back to their default) and destroys it on unmount.
 * host is the ref of the element the core mounts into. instance is null until mounted: portal
 * children into its slots once it is there. current is for imperative handles.
 */
export function useDissolveCore<P extends object, I extends DissolveInstance<P>>(create: (el: HTMLElement, props: P) => I, props: P) {
  const node = useRef<HTMLElement | null>(null);
  const host = useCallback((el: HTMLElement | null) => {
    node.current = el;
  }, []);
  const current = useRef<I | null>(null);
  const last = useRef<P>(props);
  const [instance, setInstance] = useState<I | null>(null);

  useIsomorphicLayoutEffect(() => {
    const i = create(node.current!, last.current);
    current.current = i;
    setInstance(i);
    return () => {
      i.destroy();
      current.current = null;
      setInstance(null);
    };
  }, [create]);

  useIsomorphicLayoutEffect(() => {
    const next = { ...props } as Record<string, unknown>;
    for (const k of Object.keys(last.current)) if (!(k in next)) next[k] = undefined;
    last.current = props;
    current.current?.update(next as Partial<P>);
  });

  return { host, instance, current };
}
