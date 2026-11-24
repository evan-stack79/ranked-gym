'use client'
/**
 * MorphButton for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the button itself lives in morph-button.core.ts.
 *
 * A button that morphs like the Dynamic Island: the pill folds into a round loader, then opens
 * back up as the done state.
 *
 * <MorphButton label="Pay 42 €" doneLabel="Paid" onPress={pay} />
 *
 * <MorphButton label="Send" onPress={() => send(form)} height={44} resetAfter={0} className="w-60" />
 */
import type { CSSProperties } from 'react'
import { createMorphButton, type MorphButtonProps as CoreProps } from './morph-button.core'
import { useDissolveCore } from './react'

export type MorphButtonProps = CoreProps & {
  label: string
  onPress: () => Promise<unknown> | void
  /** Outer box classes (width, margins...). The pill is centered inside it. */
  className?: string
  style?: CSSProperties
}

export function MorphButton({ className, style, ...props }: MorphButtonProps) {
  const { host } = useDissolveCore(createMorphButton, props)
  return <div ref={host} className={className} style={style} />
}
