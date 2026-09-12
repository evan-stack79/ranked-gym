import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/ui/RootErrorBoundary.tsx'
import { AppColdLaunch } from './components/brand/AppColdLaunch.tsx'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Élément #root introuvable dans index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <RootErrorBoundary>
      <AppColdLaunch>
        <App />
      </AppColdLaunch>
    </RootErrorBoundary>
  </StrictMode>,
)
