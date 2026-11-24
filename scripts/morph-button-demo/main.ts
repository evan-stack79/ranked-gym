import { createMorphButton } from '../../src/components/dissolve/morph-button.core'

const host = document.getElementById('host')!
const err = document.getElementById('err')!

createMorphButton(host, {
  label: 'Payer 9,99 €',
  doneLabel: 'Payé',
  height: 48,
  resetAfter: 2200,
  haptics: false,
  onPress: async () => {
    err.textContent = ''
    // Shift+clic simulé via flag posé par le listener capture ci-dessous.
    if ((window as unknown as { __failNext?: boolean }).__failNext) {
      ;(window as unknown as { __failNext?: boolean }).__failNext = false
      await new Promise((r) => setTimeout(r, 700))
      const msg = 'Paiement annulé. Aucun débit n’a été effectué.'
      err.textContent = msg
      throw new Error(msg)
    }
    await new Promise((r) => setTimeout(r, 900))
  },
})

host.addEventListener(
  'click',
  (e) => {
    if (e.shiftKey) (window as unknown as { __failNext?: boolean }).__failNext = true
  },
  true,
)

// Auto-play once for capture scripts (query ?auto=1).
if (new URLSearchParams(location.search).has('auto')) {
  setTimeout(() => host.click(), 400)
}
