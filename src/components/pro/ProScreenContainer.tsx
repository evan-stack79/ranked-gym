import { useCallback, useState } from 'react'
import { ProScreen } from './ProScreen'
import { getPurchasesAdapter } from '../../native/purchases'
import { scheduleTrialEndReminder } from '../../services/proTrialReminder'
import { Capacitor } from '@capacitor/core'

interface ProScreenContainerProps {
  onBack: () => void
  /** Optional Convex wiring — when absent, shows UI only (web / offline). */
  preparePurchase?: (args: {
    offerKey: 'solo_monthly' | 'solo_yearly'
    withdrawalConsent: boolean
    legalVersion: string
  }) => Promise<{
    storeAccountToken: string
    productIdApple: string
    productIdGoogle: string
    basePlanIdGoogle?: string
    purchaseAttemptId: string
  }>
  verifyApple?: (args: {
    signedTransaction: string
    purchaseAttemptId?: string
  }) => Promise<{ finishTransactionId?: string; status?: { trialEndsAt?: number | null } }>
  verifyGoogle?: (args: {
    purchaseToken: string
    productId: string
    basePlanId?: string
    purchaseAttemptId?: string
  }) => Promise<{ status?: { trialEndsAt?: number | null } }>
}

export function ProScreenContainer({
  onBack,
  preparePurchase,
  verifyApple,
  verifyGoogle,
}: ProScreenContainerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adapter = getPurchasesAdapter()
  const purchaseAvailable = Boolean(preparePurchase) && Capacitor.isNativePlatform()

  const onPrepareAndPurchase = useCallback(
    async (args: {
      offerKey: 'solo_monthly' | 'solo_yearly'
      withdrawalConsent: boolean
      legalVersion: string
    }) => {
      setError(null)
      if (!preparePurchase) {
        setError('Achat disponible uniquement dans l’app mobile.')
        return
      }
      setBusy(true)
      try {
        await adapter.configure()
        const prepared = await preparePurchase(args)
        const productId =
          adapter.platform === 'android' ? prepared.productIdGoogle : prepared.productIdApple
        const purchased = await adapter.purchase({
          offerKey: args.offerKey,
          productId,
          basePlanId: prepared.basePlanIdGoogle,
          appAccountToken: prepared.storeAccountToken,
        })
        // Never activate Pro from SDK result alone.
        if (purchased.grantsPro) {
          throw new Error('CLIENT_GRANT_FORBIDDEN')
        }
        if (adapter.platform === 'ios') {
          if (!purchased.signedTransaction || !verifyApple) {
            throw new Error('MISSING_APPLE_PROOF')
          }
          const verified = await verifyApple({
            signedTransaction: purchased.signedTransaction,
            purchaseAttemptId: prepared.purchaseAttemptId,
          })
          if (verified.finishTransactionId) {
            await adapter.finish(verified.finishTransactionId)
          }
          await scheduleTrialEndReminder(verified.status?.trialEndsAt ?? null)
        } else if (adapter.platform === 'android') {
          if (!purchased.purchaseToken || !verifyGoogle) {
            throw new Error('MISSING_GOOGLE_PROOF')
          }
          const verified = await verifyGoogle({
            purchaseToken: purchased.purchaseToken,
            productId,
            basePlanId: prepared.basePlanIdGoogle,
            purchaseAttemptId: prepared.purchaseAttemptId,
          })
          await adapter.finish(purchased.purchaseToken)
          await scheduleTrialEndReminder(verified.status?.trialEndsAt ?? null)
        } else {
          setError('Achat web indisponible en v0.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Achat impossible')
      } finally {
        setBusy(false)
      }
    },
    [adapter, preparePurchase, verifyApple, verifyGoogle],
  )

  const onRestore = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await adapter.configure()
      const restored = await adapter.restore()
      for (const item of restored) {
        if (item.signedTransaction && verifyApple) {
          const verified = await verifyApple({ signedTransaction: item.signedTransaction })
          if (verified.finishTransactionId) {
            await adapter.finish(verified.finishTransactionId)
          }
        } else if (item.purchaseToken && verifyGoogle) {
          await verifyGoogle({
            purchaseToken: item.purchaseToken,
            productId: item.productId,
          })
          await adapter.finish(item.purchaseToken)
        }
      }
      if (restored.length === 0) {
        setError('Aucun achat à restaurer sur ce compte store.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restauration impossible')
    } finally {
      setBusy(false)
    }
  }, [adapter, verifyApple, verifyGoogle])

  return (
    <ProScreen
      onBack={onBack}
      onPrepareAndPurchase={onPrepareAndPurchase}
      onRestore={onRestore}
      onManageSubscriptions={() => void adapter.manageSubscriptions()}
      purchaseAvailable={purchaseAvailable}
      busy={busy}
      error={error}
    />
  )
}
