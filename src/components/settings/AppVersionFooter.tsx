import { usePwaUpdate } from '../../hooks/usePwaUpdate'

/**
 * Pastille de version discrète + bouton « Mettre à jour » seulement
 * quand un nouveau service worker est en attente.
 */
export function AppVersionFooter() {
  const { buildLabel, updateReady, applyUpdate } = usePwaUpdate()

  return (
    <div className="flex flex-col items-center gap-2 px-2 pt-1" data-testid="app-version-footer">
      <p
        className="text-center text-[11px] leading-none tracking-wide text-[#636366]"
        data-testid="app-build-version"
      >
        {buildLabel}
      </p>
      {updateReady ? (
        <button
          type="button"
          onClick={applyUpdate}
          className="ios-press rounded-lg px-3 py-2 text-[13px] font-medium text-[#AEAEB2] active:text-white"
          data-testid="app-update-button"
        >
          Mettre à jour
        </button>
      ) : null}
    </div>
  )
}
