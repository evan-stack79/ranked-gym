import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
  acquireBodyScrollLock,
} from './bodyScrollLock'

const bodyStyle = { overflow: '' }

vi.stubGlobal('document', {
  body: { style: bodyStyle },
})

describe('bodyScrollLock', () => {
  beforeEach(() => {
    bodyStyle.overflow = ''
    __resetBodyScrollLockForTests()
  })

  it('verrouille body.overflow et restaure l’état précédent à la fermeture', () => {
    const release = acquireBodyScrollLock()
    expect(bodyStyle.overflow).toBe('hidden')
    expect(__getBodyScrollLockCountForTests()).toBe(1)
    release()
    expect(bodyStyle.overflow).toBe('')
    expect(__getBodyScrollLockCountForTests()).toBe(0)
  })

  it('empile correctement plusieurs locks (pas de restore prématuré)', () => {
    bodyStyle.overflow = 'auto'
    const releaseA = acquireBodyScrollLock()
    const releaseB = acquireBodyScrollLock()
    expect(bodyStyle.overflow).toBe('hidden')
    expect(__getBodyScrollLockCountForTests()).toBe(2)

    releaseA()
    expect(bodyStyle.overflow).toBe('hidden')
    expect(__getBodyScrollLockCountForTests()).toBe(1)

    releaseB()
    expect(bodyStyle.overflow).toBe('auto')
    expect(__getBodyScrollLockCountForTests()).toBe(0)
  })

  it('release idempotent — pas de compteur négatif / overflow fantôme', () => {
    const release = acquireBodyScrollLock()
    release()
    release()
    expect(__getBodyScrollLockCountForTests()).toBe(0)
    expect(bodyStyle.overflow).toBe('')
  })

  it('ouvrir/fermer plusieurs fois ne laisse aucun lock résiduel', () => {
    for (let i = 0; i < 5; i++) {
      const release = acquireBodyScrollLock()
      expect(bodyStyle.overflow).toBe('hidden')
      release()
      expect(bodyStyle.overflow).toBe('')
    }
    expect(__getBodyScrollLockCountForTests()).toBe(0)
  })
})
