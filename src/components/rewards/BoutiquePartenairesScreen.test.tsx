import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../services/rewardsService', () => ({
  fetchRewardsWallet: vi.fn(async () => ({
    ok: true,
    wallet: { balance: 40, earnedToday: 10, earnedThisCycle: 40 },
    caps: { dailyCap: 50, seasonCap: 1200 },
  })),
  fetchRewardsCatalog: vi.fn(async () => ({
    ok: true,
    items: [
      {
        itemId: 'item1',
        title: 'Café offert',
        categoryId: 'RP-CAT-01',
        costPoints: 150,
        stockLogical: 10,
        partner: { partnerId: 'p1', slug: 'cafe', name: 'Café Ranked' },
      },
    ],
  })),
  listMyRewardsCodes: vi.fn(async () => ({ ok: true, codes: [] })),
  redeemRewardsItem: vi.fn(),
  markRewardsCodeShown: vi.fn(),
  REWARDS_CATEGORY_LABELS: {
    'RP-CAT-01': 'Boisson / café',
  },
}))

import { BoutiquePartenairesScreen } from './BoutiquePartenairesScreen'

describe('BoutiquePartenairesScreen anti-P2W chrome', () => {
  it('renders boutique without Pass CTA / scores / € equivalent', () => {
    const html = renderToStaticMarkup(
      <BoutiquePartenairesScreen onBack={() => undefined} />,
    )
    expect(html).toContain('Boutique partenaires')
    expect(html).toContain('data-testid="boutique-partenaires"')
    expect(html.toLowerCase()).not.toContain('passe pro')
    expect(html.toLowerCase()).not.toContain('try pro')
    expect(html).not.toMatch(/€|EUR|euros?/)
    expect(html).not.toMatch(/monte de ligue|classement amis|score force/i)
    expect(html).toContain('Sans valeur monétaire')
  })
})
