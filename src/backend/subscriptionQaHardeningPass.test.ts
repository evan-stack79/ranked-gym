/**
 * Durcissement Pro post-#145 — QA M4 / m3 / m4 (un seul passage).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

describe('QA m3 — suppression fallback Apple localtest non signé', () => {
  it('appleJws n’expose plus parseLocalTestApplePayload', () => {
    const src = readFileSync(resolve(root, 'convex/lib/appleJws.ts'), 'utf8')
    expect(src).not.toMatch(/parseLocalTestApplePayload/)
    expect(src).not.toMatch(/startsWith\('localtest\.'\)/)
  })

  it('subscriptionsActions refuse tout chemin Apple localtest', () => {
    const src = readFileSync(resolve(root, 'convex/subscriptionsActions.ts'), 'utf8')
    expect(src).not.toMatch(/parseLocalTestApplePayload/)
    // Aucun branchement code Apple sur localtest. (Google localtest peut rester).
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const appleVerify = stripComments(
      src.slice(
        src.indexOf('export const verifyApplePurchase'),
        src.indexOf('export const verifyGooglePurchase'),
      ),
    )
    expect(appleVerify).not.toMatch(/localtest/)
    const appleNotif = stripComments(
      src.slice(
        src.indexOf('ingestAndProcessAppleNotification'),
        src.indexOf('ingestAndProcessGoogleRtdn'),
      ),
    )
    expect(appleNotif).not.toMatch(/localtest/)
    // Cron Apple : pas de fallback localtest.
    const cron = stripComments(src.slice(src.indexOf('processQueuedSubscriptionEvents')))
    const appleCronBranch = cron.match(
      /if \(row\.source === 'apple'[\s\S]*?} else if \(row\.source === 'google'/,
    )?.[0]
    expect(appleCronBranch).toBeTruthy()
    expect(appleCronBranch!).not.toMatch(/localtest/)
  })

  it('verifyApplePurchase exige toujours verifyAppleJwsSignature', () => {
    const src = readFileSync(resolve(root, 'convex/subscriptionsActions.ts'), 'utf8')
    const appleVerify = src.slice(
      src.indexOf('export const verifyApplePurchase'),
      src.indexOf('export const verifyGooglePurchase'),
    )
    expect(appleVerify).toMatch(/verifyAppleJwsSignature\(args\.signedTransaction\)/)
  })
})

describe('QA m4 — lookup indexé Google RTDN (pas de collect subscriptions)', () => {
  it('applyQueuedGoogleNotification utilise by_source_env_chain', () => {
    const src = readFileSync(resolve(root, 'convex/subscriptions.ts'), 'utf8')
    const start = src.indexOf('export const applyQueuedGoogleNotification')
    const end = src.indexOf('export const listQueuedSubscriptionEvents')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fn = src.slice(start, end)
    expect(fn).toMatch(/withIndex\(\s*'by_source_env_chain'/)
    expect(fn).toMatch(/\.eq\(\s*'source'\s*,\s*'google'\s*\)/)
    expect(fn).not.toMatch(/query\('subscriptions'\)\.collect\(\)/)
    expect(fn).not.toMatch(/\.collect\(\)\s*\)\.find\(/)
  })

  it('l’index by_source_env_chain existe sur subscriptions', () => {
    const schema = readFileSync(resolve(root, 'convex/schema.ts'), 'utf8')
    const start = schema.indexOf('subscriptions: defineTable')
    const end = schema.indexOf('subscriptionAccess: defineTable')
    const block = schema.slice(start, end)
    expect(block).toMatch(/\.index\(\s*'by_source_env_chain'\s*,\s*\[\s*'source'\s*,\s*'environment'\s*,\s*'storeChainKey'\s*\]\s*\)/)
  })
})

describe('QA M4 — OID Apple dans appleJwsVerify', () => {
  it('exporte et applique les OID leaf + WWDR', () => {
    const src = readFileSync(resolve(root, 'convex/lib/appleJwsVerify.ts'), 'utf8')
    expect(src).toMatch(/APPLE_LEAF_RECEIPT_OID\s*=\s*'1\.2\.840\.113635\.100\.6\.11\.1'/)
    expect(src).toMatch(/APPLE_WWDR_INTERMEDIATE_OID\s*=\s*'1\.2\.840\.113635\.100\.6\.2\.1'/)
    expect(src).toMatch(/assertAppleChainOids/)
    expect(src).toMatch(/APPLE_LEAF_OID_MISSING/)
    expect(src).toMatch(/APPLE_INTERMEDIATE_OID_MISSING/)
    expect(src).toMatch(/x5cDerB64\.length !== 3/)
  })
})
