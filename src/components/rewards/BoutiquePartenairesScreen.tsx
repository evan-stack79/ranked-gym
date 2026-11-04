import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Copy, Gift, Ticket } from 'lucide-react'
import {
  fetchRewardsCatalog,
  fetchRewardsWallet,
  listMyRewardsCodes,
  markRewardsCodeShown,
  redeemRewardsItem,
  REWARDS_CATEGORY_LABELS,
} from '../../services/rewardsService'
import { ProfileSubScreenHeader } from '../settings/ProfileSubScreenChrome'

type BoutiqueRoute = 'home' | 'confirm' | 'codes'

type CatalogItem = {
  itemId: string
  title: string
  categoryId: string
  costPoints: number
  stockLogical: number
  partner: { partnerId: string; slug: string; name: string } | null
}

type WalletView = {
  balance: number
  earnedToday: number
  earnedThisCycle: number
}

type CapsView = {
  dailyCap: number
  seasonCap: number
}

type CodeRow = {
  redemptionId: string
  code: string | null
  status: string
  costPoints: number
  createdAt: number
  expiresAt: number
  itemTitle: string
  categoryId: string | null
}

interface BoutiquePartenairesScreenProps {
  onBack: () => void
}

function Shell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <section className="ios-fade-up space-y-5 pb-10" data-testid="boutique-partenaires">
      <ProfileSubScreenHeader title={title} subtitle={subtitle} onBack={onBack} />
      {children}
    </section>
  )
}

function BalanceBar({
  wallet,
  caps,
}: {
  wallet: WalletView
  caps: CapsView
}) {
  return (
    <div
      className="rounded-2xl border border-[#25282A] bg-[#141416]/80 px-4 py-3"
      data-testid="rewards-balance"
    >
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
        Points partenaires
      </p>
      <p className="mt-1 text-[28px] font-bold tracking-tight text-white">
        {wallet.balance}
        <span className="ml-1 text-[15px] font-semibold text-[#ACB4BA]">pts</span>
      </p>
      <p className="mt-2 text-[12px] leading-snug text-[#717C83]">
        Aujourd&apos;hui {wallet.earnedToday}/{caps.dailyCap} · Saison {wallet.earnedThisCycle}/
        {caps.seasonCap}
      </p>
      <p className="mt-1 text-[11px] text-[#717C83]">
        Sans valeur monétaire · non convertibles · non cessibles
      </p>
    </div>
  )
}

export function BoutiquePartenairesScreen({ onBack }: BoutiquePartenairesScreenProps) {
  const [route, setRoute] = useState<BoutiqueRoute>('home')
  const [wallet, setWallet] = useState<WalletView>({
    balance: 0,
    earnedToday: 0,
    earnedThisCycle: 0,
  })
  const [caps, setCaps] = useState<CapsView>({ dailyCap: 50, seasonCap: 1200 })
  const [items, setItems] = useState<CatalogItem[]>([])
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [selected, setSelected] = useState<CatalogItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [w, c, mine] = await Promise.all([
        fetchRewardsWallet(),
        fetchRewardsCatalog(),
        listMyRewardsCodes(),
      ])
      if (w?.wallet) {
        setWallet({
          balance: w.wallet.balance ?? 0,
          earnedToday: w.wallet.earnedToday ?? 0,
          earnedThisCycle: w.wallet.earnedThisCycle ?? 0,
        })
      }
      if (w?.caps) {
        setCaps({
          dailyCap: w.caps.dailyCap ?? 50,
          seasonCap: w.caps.seasonCap ?? 1200,
        })
      }
      setItems(Array.isArray(c?.items) ? c.items : [])
      setCodes(Array.isArray(mine?.codes) ? mine.codes : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openConfirm = (item: CatalogItem) => {
    setSelected(item)
    setLastCode(null)
    setError(null)
    setRoute('confirm')
  }

  const doRedeem = async () => {
    if (!selected || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await redeemRewardsItem(selected.itemId)
      if (!result?.ok) {
        setError(
          result?.error === 'REWARDS_INSUFFICIENT_BALANCE'
            ? 'Solde insuffisant'
            : result?.error === 'REWARDS_ITEM_UNAVAILABLE'
              ? 'Cadeau indisponible'
              : 'Échange impossible',
        )
        return
      }
      setLastCode(result.code)
      if (result.redemptionId) {
        try {
          await markRewardsCodeShown(result.redemptionId)
        } catch {
          /* first show is best-effort */
        }
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échange impossible')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* ignore */
    }
  }

  if (route === 'confirm' && selected) {
    return (
      <Shell
        title="Confirmer l'échange"
        subtitle={selected.partner?.name}
        onBack={() => {
          setRoute('home')
          setSelected(null)
          setLastCode(null)
        }}
      >
        <BalanceBar wallet={wallet} caps={caps} />
        <div className="rounded-2xl border border-[#25282A] bg-[#141416]/80 p-4">
          <p className="text-[13px] text-[#ACB4BA]">
            {REWARDS_CATEGORY_LABELS[selected.categoryId] ?? selected.categoryId}
          </p>
          <p className="mt-1 text-[20px] font-bold text-white">{selected.title}</p>
          <p className="mt-3 text-[15px] text-white">
            Coût : <span className="font-semibold">{selected.costPoints} pts</span>
          </p>
          <p className="mt-2 text-[12px] leading-snug text-[#717C83]">
            Un code unique sera généré. Points sans valeur monétaire — pas d&apos;équivalent €,
            non remboursables.
          </p>
        </div>
        {lastCode ? (
          <div
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"
            data-testid="rewards-redeem-success"
          >
            <p className="text-[13px] font-semibold text-emerald-200">Code prêt</p>
            <p className="mt-2 font-mono text-[18px] font-bold tracking-wide text-white">
              {lastCode}
            </p>
            <button
              type="button"
              className="ios-press mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-white"
              onClick={() => void copyCode(lastCode, 'new')}
            >
              <Copy className="h-4 w-4" />
              {copiedId === 'new' ? 'Copié' : 'Copier'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || wallet.balance < selected.costPoints}
            onClick={() => void doRedeem()}
            className="ios-press w-full rounded-2xl bg-[#FF0702] py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
            data-testid="rewards-confirm-redeem"
          >
            {busy ? 'Échange…' : 'Confirmer l’échange'}
          </button>
        )}
        {error ? <p className="text-[13px] text-[#FF907F]">{error}</p> : null}
        <button
          type="button"
          className="ios-press text-[14px] font-semibold text-[#ACB4BA]"
          onClick={() => setRoute('codes')}
        >
          Voir mes codes
        </button>
      </Shell>
    )
  }

  if (route === 'codes') {
    return (
      <Shell title="Mes codes" subtitle="Caisse partenaire" onBack={() => setRoute('home')}>
        <BalanceBar wallet={wallet} caps={caps} />
        {codes.length === 0 ? (
          <p className="text-[14px] text-[#ACB4BA]">Aucun code pour l’instant.</p>
        ) : (
          <ul className="space-y-2" data-testid="rewards-codes-list">
            {codes.map((row) => (
              <li
                key={row.redemptionId}
                className="rounded-2xl border border-[#25282A] bg-[#141416]/80 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">{row.itemTitle}</p>
                    <p className="mt-0.5 text-[12px] text-[#ACB4BA]">
                      {row.costPoints} pts · {row.status}
                    </p>
                    {row.code ? (
                      <p className="mt-2 font-mono text-[14px] tracking-wide text-white">
                        {row.code}
                      </p>
                    ) : null}
                  </div>
                  {row.code ? (
                    <button
                      type="button"
                      className="ios-press shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white"
                      aria-label="Copier le code"
                      onClick={() => void copyCode(row.code!, row.redemptionId)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {copiedId === row.redemptionId ? (
                  <p className="mt-1 text-[11px] text-emerald-300">Copié</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="text-[13px] text-[#FF907F]">{error}</p> : null}
      </Shell>
    )
  }

  return (
    <Shell
      title="Boutique partenaires"
      subtitle="Cadeaux marques · hors scores Ranked"
      onBack={onBack}
    >
      <BalanceBar wallet={wallet} caps={caps} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRoute('codes')}
          className="ios-press inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#25282A] bg-[#141416]/80 py-3 text-[14px] font-semibold text-white"
          data-testid="rewards-open-codes"
        >
          <Ticket className="h-4 w-4" />
          Mes codes
        </button>
      </div>

      {error ? <p className="text-[13px] text-[#FF907F]">{error}</p> : null}

      <div className="space-y-2" data-testid="rewards-catalog">
        <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-[#ACB4BA]">
          Catalogue
        </p>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-[#25282A] bg-[#141416]/80 px-4 py-4 text-[14px] text-[#ACB4BA]">
            Catalogue bientôt disponible. Les points s’accumulent déjà sur tes séances Discipline
            validées.
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.itemId}
              type="button"
              onClick={() => openConfirm(item)}
              className="ios-press flex w-full items-center gap-3 rounded-2xl border border-[#25282A] bg-[#141416]/80 px-4 py-3.5 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#EBEBF5]">
                <Gift className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-white">
                  {item.title}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-[#ACB4BA]">
                  {item.partner?.name ?? 'Partenaire'} ·{' '}
                  {REWARDS_CATEGORY_LABELS[item.categoryId] ?? item.categoryId}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-bold text-white">{item.costPoints} pts</span>
            </button>
          ))
        )}
      </div>

      {/* RP-07 / RK-03 : no Pass CTA, no Force/Discipline scores, no € equivalent */}
      <p className="px-1 text-center text-[11px] leading-snug text-[#717C83]">
        Boutique séparée du hub Ranked Force / Discipline. Même catalogue pour tous.
      </p>
    </Shell>
  )
}
