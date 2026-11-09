import { useCallback, useEffect, useState } from 'react'
import { ProScreen } from './ProScreen'
import { ProReceiptScreen, type ProReceiptView } from './ProReceiptScreen'
import { getPurchasesAdapter } from '../../native/purchases'
import { scheduleTrialEndReminder } from '../../services/proTrialReminder'
import {
  fetchLatestReceipt,
  fetchSubscriptionProfile,
  isSubscriptionsBackendReady,
  recordPurchaseConsent,
  setDateOfBirth,
  verifyApplePurchase,
  verifyGooglePurchase,
} from '../../services/subscriptionsService'
import {
  loadProReceiptOffline,
  saveProReceiptOffline,
} from '../../services/proReceiptOffline'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../../context/AuthContext'

interface ProScreenContainerProps {
  onBack: () => void
}

export function ProScreenContainer({ onBack }: ProScreenContainerProps) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasDob, setHasDob] = useState<boolean | null>(null)
  const [receipt, setReceipt] = useState<ProReceiptView | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const adapter = getPurchasesAdapter()
  const backendReady = isSubscriptionsBackendReady()
  const purchaseAvailable = backendReady && Capacitor.isNativePlatform()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!backendReady) {
        if (!cancelled) setHasDob(false)
        return
      }
      try {
        const profile = await fetchSubscriptionProfile()
        if (!cancelled) setHasDob(Boolean(profile?.hasDateOfBirth))
        const latest = await fetchLatestReceipt()
        if (!cancelled && latest) {
          const view: ProReceiptView = {
            offerKey: latest.offerKey,
            productId: latest.productId,
            priceDisplay: latest.priceDisplay,
            firstChargeAt: latest.firstChargeAt,
            firstChargeAmountDisplay: latest.firstChargeAmountDisplay,
            withdrawalConsentAt: latest.withdrawalConsentAt,
            legalVersionL05: latest.legalVersionL05,
            cancelUrl: latest.cancelUrl,
            createdAt: latest.createdAt,
          }
          setReceipt(view)
          if (user?.id) saveProReceiptOffline(user.id, view)
        } else if (user?.id) {
          const offline = loadProReceiptOffline(user.id)
          if (!cancelled && offline) setReceipt(offline)
        }
      } catch {
        if (!cancelled) setHasDob(false)
        if (user?.id) {
          const offline = loadProReceiptOffline(user.id)
          if (!cancelled && offline) setReceipt(offline)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backendReady, user?.id])

  const onSaveDob = useCallback(async (iso: string) => {
    setError(null)
    setBusy(true)
    try {
      await setDateOfBirth(iso)
      setHasDob(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Date de naissance refusée')
    } finally {
      setBusy(false)
    }
  }, [])

  const onPrepareAndPurchase = useCallback(
    async (args: {
      offerKey: 'solo_monthly' | 'solo_yearly'
      withdrawalConsent: boolean
      legalVersion: string
    }) => {
      setError(null)
      if (!backendReady) {
        setError('Achat disponible uniquement dans l’app mobile avec Convex configuré.')
        return
      }
      setBusy(true)
      try {
        await adapter.configure()
        // Consentement serveur AVANT feuille store (AB-b / Architecte).
        const prepared = await recordPurchaseConsent(args)
        if ((prepared as { grantsPro?: boolean }).grantsPro) {
          throw new Error('CLIENT_GRANT_FORBIDDEN')
        }
        const productId =
          adapter.platform === 'android' ? prepared.productIdGoogle : prepared.productIdApple
        const purchased = await adapter.purchase({
          offerKey: args.offerKey,
          productId,
          basePlanId: prepared.basePlanIdGoogle,
          appAccountToken: prepared.storeAccountToken,
        })
        if (purchased.grantsPro) throw new Error('CLIENT_GRANT_FORBIDDEN')

        if (adapter.platform === 'ios') {
          if (!purchased.signedTransaction) throw new Error('MISSING_APPLE_PROOF')
          const verified = await verifyApplePurchase({
            signedTransaction: purchased.signedTransaction,
            purchaseAttemptId: prepared.purchaseAttemptId,
          })
          if (verified.finishTransactionId) {
            await adapter.finish(verified.finishTransactionId)
          }
          await scheduleTrialEndReminder(verified.status?.trialEndsAt ?? null)
          if (verified.receiptId) {
            const latest = await fetchLatestReceipt()
            if (latest && user?.id) {
              const view: ProReceiptView = {
                offerKey: latest.offerKey,
                productId: latest.productId,
                priceDisplay: latest.priceDisplay,
                firstChargeAt: latest.firstChargeAt,
                firstChargeAmountDisplay: latest.firstChargeAmountDisplay,
                withdrawalConsentAt: latest.withdrawalConsentAt,
                legalVersionL05: latest.legalVersionL05,
                cancelUrl: latest.cancelUrl,
                createdAt: latest.createdAt,
              }
              setReceipt(view)
              saveProReceiptOffline(user.id, view)
              setShowReceipt(true)
            }
          }
        } else if (adapter.platform === 'android') {
          if (!purchased.purchaseToken) throw new Error('MISSING_GOOGLE_PROOF')
          const verified = await verifyGooglePurchase({
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
    [adapter, backendReady, user?.id],
  )

  const onRestore = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await adapter.configure()
      const restored = await adapter.restore()
      for (const item of restored) {
        if (item.signedTransaction) {
          const verified = await verifyApplePurchase({
            signedTransaction: item.signedTransaction,
          })
          if (verified.finishTransactionId) {
            await adapter.finish(verified.finishTransactionId)
          }
        } else if (item.purchaseToken) {
          await verifyGooglePurchase({
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
  }, [adapter])

  if (showReceipt && receipt) {
    return <ProReceiptScreen receipt={receipt} onBack={() => setShowReceipt(false)} />
  }

  return (
    <ProScreen
      onBack={onBack}
      onPrepareAndPurchase={onPrepareAndPurchase}
      onRestore={onRestore}
      onManageSubscriptions={() => void adapter.manageSubscriptions()}
      purchaseAvailable={purchaseAvailable}
      busy={busy}
      error={error}
      needsDateOfBirth={hasDob === false}
      onSaveDateOfBirth={onSaveDob}
      onOpenReceipt={receipt ? () => setShowReceipt(true) : undefined}
    />
  )
}
