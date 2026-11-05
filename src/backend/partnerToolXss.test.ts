/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canCreatePartnerInvite,
  type PartnerSessionAccount,
} from '../../convex/lib/partnerAuth'
import {
  PARTNER_CODE_LOG_REJECTED,
  sanitizePartnerCode,
  sanitizePartnerReason,
} from '../../convex/lib/partnerCode'
import {
  escapeHtml,
  renderHistoryItemsHtml,
  sanitizePartnerCode as clientSanitize,
} from '../../partner-tool/src/htmlSafety'
import {
  partnerLookupCodeCore,
  partnerMarkConsumedGuarded,
} from '../../convex/rewards'
import type { Id } from '../../convex/_generated/dataModel'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    rewardsPartnerActionLog: [],
    rewardsRedemptionCode: [],
    rewardsCatalogItem: [],
    rewardsPartner: [],
  }

  insert(table: string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    if (!this.rows[table]) this.rows[table] = []
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: string) {
    return {
      withIndex: () => ({
        first: () => Promise.resolve((this.rows[table] ?? [])[0] ?? null),
        collect: () => Promise.resolve([...(this.rows[table] ?? [])]),
      }),
      collect: () => Promise.resolve([...(this.rows[table] ?? [])]),
      first: () => Promise.resolve((this.rows[table] ?? [])[0] ?? null),
    }
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch() {
    return Promise.resolve()
  }

  table(name: string) {
    return this.rows[name] ?? []
  }
}

describe('QA M1 — XSS / code sanitize', () => {
  it('escapeHtml neutralizes script / img onerror payloads', () => {
    const payload = `<img src=x onerror=alert(sessionStorage.length)>`
    const escaped = escapeHtml(payload)
    expect(escaped).not.toContain('<img')
    expect(escaped).toContain('&lt;img')
    expect(escaped).toContain('&gt;')
    // Attribute text may remain, but tags are inert once escaped.
    document.body.innerHTML = escaped
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('Historique HTML does not execute XSS when code/reason are hostile', () => {
    const payload = `<img src=x onerror=alert(1)>`
    const html = renderHistoryItemsHtml([
      {
        code: payload,
        action: 'lookup',
        result: 'denied',
        errorCode: 'REWARDS_CODE_NOT_FOUND',
        reason: `<script>alert('x')</script>`,
        createdAt: Date.parse('2026-11-04T12:00:00.000Z'),
      },
    ])
    document.body.innerHTML = `<ul>${html}</ul>`
    expect(document.querySelectorAll('img')).toHaveLength(0)
    expect(document.querySelectorAll('script')).toHaveLength(0)
    const text = document.body.textContent ?? ''
    expect(text).toContain('<img src=x onerror=alert(1)>')
    expect(text).toContain("<script>alert('x')</script>")
    // Escaped entities present in DOM source
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('sanitizePartnerCode rejects HTML / XSS and accepts RG opaque codes', () => {
    expect(sanitizePartnerCode(`<img src=x onerror=alert(1)>`).ok).toBe(false)
    expect(sanitizePartnerCode('"><svg/onload=1>').ok).toBe(false)
    expect(sanitizePartnerCode('ab').ok).toBe(false)
    expect(sanitizePartnerCode('RG-ABCDEFGHIJKLMNOP').ok).toBe(true)
    expect(clientSanitize('RG-ABCDEFGHIJKLMNOP')).toEqual({
      ok: true,
      code: 'RG-ABCDEFGHIJKLMNOP',
    })
  })

  it('lookup of XSS payload does not journalize raw HTML (logs placeholder)', async () => {
    const db = new FakeDb()
    const account: PartnerSessionAccount = {
      accountId: 'rewardsPartnerAccount:1' as Id<'rewardsPartnerAccount'>,
      email: 'staff@a.test',
      partnerId: 'rewardsPartner:1' as Id<'rewardsPartner'>,
      role: 'partner_staff',
      sessionId: 'rewardsPartnerSession:1' as Id<'rewardsPartnerSession'>,
    }
    const payload = `<img src=x onerror=alert(sessionStorage.length)>`
    const looked = await partnerLookupCodeCore({ db } as any, {
      account,
      code: payload,
      now: Date.now(),
      log: true,
    })
    expect(looked).toEqual({ ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' })
    const log = db.table('rewardsPartnerActionLog')[0]
    expect(log?.code).toBe(PARTNER_CODE_LOG_REJECTED)
    expect(String(log?.code)).not.toContain('<')
    expect(JSON.stringify(db.table('rewardsPartnerActionLog'))).not.toContain('onerror')
  })

  it('consume of XSS payload denied before mark + safe log', async () => {
    const db = new FakeDb()
    const account: PartnerSessionAccount = {
      accountId: 'rewardsPartnerAccount:1' as Id<'rewardsPartnerAccount'>,
      email: 'staff@a.test',
      partnerId: 'rewardsPartner:1' as Id<'rewardsPartner'>,
      role: 'partner_staff',
      sessionId: 'rewardsPartnerSession:1' as Id<'rewardsPartnerSession'>,
    }
    const res = await partnerMarkConsumedGuarded({ db } as any, {
      account,
      code: '<script>alert(1)</script>',
      now: Date.now(),
    })
    expect(res).toEqual({ ok: false, error: 'REWARDS_CODE_INVALID_FORMAT' })
    expect(db.table('rewardsPartnerActionLog')[0]?.code).toBe(PARTNER_CODE_LOG_REJECTED)
  })

  it('sanitizePartnerReason strips angle brackets', () => {
    expect(sanitizePartnerReason(`rupture <b>ok</b>`)).toBe('rupture bok/b')
    expect(sanitizePartnerReason(`rupture <b>ok</b>`)).not.toContain('<')
    expect(sanitizePartnerReason('  stock  ')).toBe('stock')
  })

  it('partner-tool main.ts uses escapeHtml / renderHistoryItemsHtml', () => {
    const raw = readFileSync(resolve('partner-tool/src/main.ts'), 'utf8')
    expect(raw).toMatch(/escapeHtml/)
    expect(raw).toMatch(/renderHistoryItemsHtml/)
    expect(raw).toMatch(/sanitizePartnerCode/)
    // No raw unescaped history interpolation of h.code
    expect(raw).not.toMatch(/\$\{h\.code\}/)
    expect(raw).not.toMatch(/\$\{L\.itemTitle\}/)
    expect(raw).not.toMatch(/\$\{h\.reason\}/)
  })
})

describe('QA m1 — partner_admin invite staff only', () => {
  it('partner_admin cannot invite partner_admin; rg_admin can', () => {
    expect(canCreatePartnerInvite('partner_admin', 'partner_staff')).toBe(true)
    expect(canCreatePartnerInvite('partner_admin', 'partner_admin')).toBe(false)
    expect(canCreatePartnerInvite('rg_admin', 'partner_admin')).toBe(true)
    expect(canCreatePartnerInvite('partner_staff', 'partner_staff')).toBe(false)
  })
})

describe('QA m2 — inactive partner blocks session', () => {
  it('resolvePartnerSession source requires rewardsPartner.active', () => {
    const raw = readFileSync(resolve('convex/lib/partnerAuth.ts'), 'utf8')
    expect(raw).toMatch(/partner\.active/)
    expect(raw).toMatch(/!partner \|\| !partner\.active/)
    const login = readFileSync(resolve('convex/partnerAuth.ts'), 'utf8')
    expect(login).toMatch(/PARTNER_INACTIVE/)
  })
})
