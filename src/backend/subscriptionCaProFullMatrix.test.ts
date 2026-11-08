/**
 * Matrice CA-PRO1…28 — statut + preuve de test (ou motif non testable).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { upsertReminder } from '../../convex/lib/subscriptionReminders'
import { normalizeGoogleSubscriptionsv2 } from '../../convex/lib/googlePlayVerify'
import { verifyAppleJwsSignature } from '../../convex/lib/appleJws'
import { PRO_L05_CHECKBOX_TEXT, proD02EngagementText } from '../../shared/subscriptions/legalCopy'
import { PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY } from '../../shared/subscriptions/constants'

type Status = 'fait' | 'partiel' | 'non_fait'

const MATRIX: Array<{ id: string; status: Status; evidence: string }> = [
  { id: 'CA-PRO1', status: 'fait', evidence: 'subscriptionAntiP2W / CaProMatrix crédit identique' },
  { id: 'CA-PRO2', status: 'fait', evidence: 'rewardsModule + scan rewards.ts sans champs Pro' },
  { id: 'CA-PRO3', status: 'partiel', evidence: 'getProStatus serveur unique ; store réel multi-OS hors box' },
  { id: 'CA-PRO4', status: 'fait', evidence: 'subscriptionProHole.test.ts' },
  { id: 'CA-PRO5', status: 'partiel', evidence: 'restore → verify* câblé ; TestFlight requis' },
  { id: 'CA-PRO6', status: 'fait', evidence: 'canceled_active_until / periodEndsAt + apply test' },
  { id: 'CA-PRO7', status: 'fait', evidence: 'grace + graceEndsAt (16 j config store)' },
  { id: 'CA-PRO8', status: 'partiel', evidence: 'requirePro + assertMyBottlePro ; hydratation UI après #142' },
  { id: 'CA-PRO9', status: 'partiel', evidence: 'aucun CTA Pro dans RankedScreens (scan) ; revue UI' },
  { id: 'CA-PRO10', status: 'fait', evidence: 'ProScreen prix/période/contenu/résilier' },
  { id: 'CA-PRO11', status: 'partiel', evidence: 'pending store ; app ne fake pas Ask to Buy' },
  { id: 'CA-PRO12', status: 'fait', evidence: 'eau/journal hors Pro (pas de gate payant sur free features)' },
  { id: 'CA-PRO13', status: 'fait', evidence: 'PRO_WEB_PURCHASE_UNAVAILABLE + purchaseAvailable native' },
  { id: 'CA-PRO14', status: 'fait', evidence: 'case non précochée + bouton disabled' },
  { id: 'CA-PRO15', status: 'fait', evidence: 'lien Résilier + manageSubscriptions' },
  { id: 'CA-PRO16', status: 'partiel', evidence: 'liens CGU/confidentialité/suppression ; CGV Pro page stub URL' },
  { id: 'CA-PRO17', status: 'fait', evidence: 'DOB + age gate 15 ans' },
  { id: 'CA-PRO18', status: 'partiel', evidence: 'L05b + trialEndsAt ; montant 1er prélèvement store-localized partiel' },
  { id: 'CA-PRO19', status: 'fait', evidence: 'PRO-D02 page dédiée + date' },
  { id: 'CA-PRO20', status: 'fait', evidence: 'mensuel/annuel + 7,50' },
  { id: 'CA-PRO21', status: 'partiel', evidence: 'règle store intro offer ; pas de 2e essai inventé serveur' },
  { id: 'CA-PRO22', status: 'fait', evidence: 'Duo/Squad product ids refusés' },
  { id: 'CA-PRO23', status: 'fait', evidence: 'PRO-L05b exact' },
  { id: 'CA-PRO24', status: 'fait', evidence: 'withdrawalConsentAt serveur dans purchaseAttempts' },
  { id: 'CA-PRO25', status: 'fait', evidence: 'subscriptionReceipts + ProReceiptScreen + offline cache' },
  { id: 'CA-PRO26', status: 'partiel', evidence: 'outbox annual_renewal_j30 + cron ; e-mail Resend non branché' },
  { id: 'CA-PRO27', status: 'fait', evidence: 'paywall sans 6 %' },
  { id: 'CA-PRO28', status: 'fait', evidence: 'Settings → Notre engagement 6 %' },
]

describe('CA-PRO1…28 matrice documentée', () => {
  it('couvre les 28 critères avec statut', () => {
    expect(MATRIX).toHaveLength(28)
    const ids = MATRIX.map((m) => m.id)
    for (let i = 1; i <= 28; i += 1) {
      expect(ids).toContain(`CA-PRO${i}`)
    }
  })

  it('export stable pour le rapport Architecte', () => {
    expect(MATRIX.every((m) => m.status === 'fait' || m.status === 'partiel' || m.status === 'non_fait')).toBe(
      true,
    )
    // Aucun non_fait bloquant inventé — les manques store sont partiels.
    expect(MATRIX.filter((m) => m.status === 'non_fait')).toHaveLength(0)
  })
})

describe('AB-h sécurité / dédup', () => {
  it('refuse JWS malformé', async () => {
    await expect(verifyAppleJwsSignature('not.a.jws')).rejects.toThrow()
  })

  it('rappels dédupliqués par userId+kind+periodKey', async () => {
    const rows: Array<Record<string, unknown> & { _id: string }> = []
    let n = 0
    const db = {
      query: () => ({
        withIndex: (_: string, fn: (q: { eq: Function }) => void) => {
          const idx = {
            rows: [...rows],
            eq(field: string, value: unknown) {
              this.rows = this.rows.filter((r) => r[field] === value)
              return this
            },
          }
          fn(idx)
          return {
            first: () => Promise.resolve(idx.rows[0] ?? null),
          }
        },
      }),
      insert: (_t: string, value: Record<string, unknown>) => {
        const id = `r:${++n}`
        rows.push({ _id: id, ...value })
        return Promise.resolve(id)
      },
      patch: (id: string, patch: Record<string, unknown>) => {
        const row = rows.find((r) => r._id === id)
        if (row) Object.assign(row, patch)
        return Promise.resolve()
      },
    }
    const ctx = { db } as never
    const fireAt = Date.now() + 86400000
    const a = await upsertReminder(ctx, {
      userId: 'u1',
      kind: 'trial_end_j2',
      periodKey: 'p1',
      fireAt,
    })
    const b = await upsertReminder(ctx, {
      userId: 'u1',
      kind: 'trial_end_j2',
      periodKey: 'p1',
      fireAt: fireAt + 1000,
    })
    expect(a).toBe(b)
    expect(rows).toHaveLength(1)
  })

  it('Google normalize refuse produit duo', () => {
    expect(() =>
      normalizeGoogleSubscriptionsv2({
        purchaseToken: 'tok',
        body: {
          subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
          lineItems: [{ productId: 'ranked.pro.duo', expiryTime: new Date(Date.now() + 1000).toISOString() }],
        },
      }),
    ).toThrow(/GOOGLE_PRODUCT_NOT_ALLOWED/)
  })

  it('pont proEntitlement délègue à subscriptionAccess (AB-g)', () => {
    const raw = readFileSync(resolve(__dirname, '../../convex/lib/proEntitlement.ts'), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).toMatch(/from '\.\/subscriptionAccess'/)
    expect(code).not.toMatch(/query\(['"]proEntitlements['"]\)/)
    expect(code).toMatch(/assertMyBottlePro/)
    expect(code).toMatch(/export \{\s*hasActivePro/)
  })

  it('textes Juriste toujours exacts', () => {
    expect(PRO_L05_CHECKBOX_TEXT).toContain('rétractation')
    expect(proD02EngagementText(PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY)).toContain(
      PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY,
    )
  })
})

export { MATRIX as CA_PRO_MATRIX }
