import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/ui/RootErrorBoundary.tsx'
import { AppColdLaunch } from './components/brand/AppColdLaunch.tsx'
import { ColdLaunchAccueilFixture } from './fixtures/ColdLaunchAccueilFixture.tsx'
import { NutritionUxFixture } from './fixtures/NutritionUxFixture.tsx'
import { AuthWelcomeLoggedInFixture } from './fixtures/AuthWelcomeLoggedInFixture.tsx'
import { AuthWelcomeSheetFixture } from './fixtures/AuthWelcomeSheetFixture.tsx'
import { LegalDocumentScreen } from './components/legal/LegalDocumentScreen.tsx'
import { legalKindFromPath } from './components/legal/legalRoutes.ts'
import { ConvexClientProvider } from './lib/ConvexClientProvider.tsx'
import { initSecureAuthStorage } from './services/secureAuthStorage'
import { initSecureLocalStore } from './services/secureLocalStore'

function requireRoot(): HTMLElement {
  const el = document.getElementById('root')
  if (!el) {
    throw new Error('Élément #root introuvable dans index.html')
  }
  return el
}

const rootEl = requireRoot()

function resolveBootTree() {
  if (typeof window === 'undefined') return <App />
  const path = window.location.pathname
  const legal = legalKindFromPath(path)
  if (legal) return <LegalDocumentScreen kind={legal} />
  if (path === '/accueil-fixture') return <ColdLaunchAccueilFixture />
  if (path === '/nutrition-fixture') return <NutritionUxFixture />
  if (path === '/auth-welcome-logged-in-fixture') return <AuthWelcomeLoggedInFixture />
  if (path === '/auth-welcome-sheet-fixture') return <AuthWelcomeSheetFixture />
  return <App />
}

function isColdLaunchPath() {
  if (typeof window === 'undefined') return true
  const path = window.location.pathname
  if (legalKindFromPath(path)) return false
  if (path === '/auth-welcome-sheet-fixture') return false
  return true
}

async function boot() {
  try {
    await initSecureAuthStorage()
    await initSecureLocalStore()
  } catch {
    /* least-bad web fallback already used by storage adapters */
  }

  const tree = resolveBootTree()
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <ConvexClientProvider>
          {isColdLaunchPath() ? <AppColdLaunch>{tree}</AppColdLaunch> : tree}
        </ConvexClientProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
}

void boot()
