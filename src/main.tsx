import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/ui/RootErrorBoundary.tsx'
import { AppColdLaunch } from './components/brand/AppColdLaunch.tsx'
import { ColdLaunchAccueilFixture } from './fixtures/ColdLaunchAccueilFixture.tsx'
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

async function boot() {
  try {
    await initSecureAuthStorage()
    await initSecureLocalStore()
  } catch {
    /* least-bad web fallback already used by storage adapters */
  }

  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <ConvexClientProvider>
          <AppColdLaunch>
            {typeof window !== 'undefined' && window.location.pathname === '/accueil-fixture' ? (
              <ColdLaunchAccueilFixture />
            ) : (
              <App />
            )}
          </AppColdLaunch>
        </ConvexClientProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
}

void boot()
