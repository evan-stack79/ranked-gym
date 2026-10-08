import { useEffect, useRef, type ReactNode } from 'react'
import { isAccueilGalleryEnabled } from '../../backend/accueilGalleryFeatureFlag'
import { useAuth } from '../../context/AuthContext'
import { BrandMark } from '../brand/BrandMark'
import { BottomNav } from './BottomNav'
import { StreakCelebrationHost } from '../streak/StreakCelebrationHost'
import { RestTimerOverlay, REST_BAR_CONTENT_PAD } from '../training/RestTimerOverlay'
import { useRestTimerContext, type RestPresetSec } from '../../context/RestTimerContext'
import type { TabId } from '../../types'
import { useAdaptiveBottomNav } from '../../hooks/useAdaptiveBottomNav'
import { shouldShowBrandHeader } from './shouldShowBrandHeader'

interface AppLayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining?: () => void
  hasActiveWorkout?: boolean
  hideBottomNav?: boolean
  children: ReactNode
}

export function AppLayout({
  activeTab,
  onTabChange,
  onStartTraining = () => onTabChange('training'),
  hasActiveWorkout = false,
  hideBottomNav = false,
  children,
}: AppLayoutProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const { streakCelebration } = useAuth()
  const {
    state,
    isBarVisible,
    readyBarEnabled,
    chromeHidden,
    start,
    pause,
    resume,
    skip,
    dismiss,
  } = useRestTimerContext()

  const streakCelebrationActive = Boolean(streakCelebration)
  const showHeader = shouldShowBrandHeader(activeTab, chromeHidden)
  const { mode: bottomNavMode, keyboardOpen, expand } = useAdaptiveBottomNav({ mainRef, resetKey: activeTab })
  const showBottomNav = !chromeHidden && !hideBottomNav && !keyboardOpen
  const bottomNavObscured = streakCelebrationActive
  const showReadyBar = !chromeHidden && activeTab === 'training' && readyBarEnabled
  const floatingPillNav = isAccueilGalleryEnabled()

  useEffect(() => {
    if (floatingPillNav) {
      document.documentElement.dataset.bottomNavPreview = 'floating-pill'
    } else {
      delete document.documentElement.dataset.bottomNavPreview
    }
    return () => {
      delete document.documentElement.dataset.bottomNavPreview
    }
  }, [floatingPillNav])

  return (
    <div
      ref={shellRef}
      className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden mesh-bg font-sans"
      data-streak-celebration-active={streakCelebrationActive ? '' : undefined}
      inert={streakCelebrationActive ? true : undefined}
    >
      {/*
        Barre marque HORS du conteneur de scroll (`main`) : elle reste visible
        pendant le scroll sans dépendre de `position: sticky` (souvent cassé
        sur iOS PWA quand un ancêtre scroll/overflow est en jeu).
      */}
      {showHeader ? (
        <header
          className="sticky top-0 z-30 shrink-0 border-b border-white/5"
          data-app-brand-header="1"
          aria-hidden={streakCelebrationActive ? true : undefined}
          /* Safe-area seule — pas de padding fixe empilé par-dessus (Dynamic Island). */
          style={{
            paddingTop: 'var(--app-safe-area-top, env(safe-area-inset-top, 0px))',
          }}
        >
          {/*
            Fond (et éventuel blur) en calque frère ABSOLU sous le contenu —
            jamais backdrop-filter / opacity / filter sur un ancêtre du logo/texte
            (WebKit iOS rasterise alors les enfants en basse résolution).
          */}
          <div className="relative">
            <div
              aria-hidden="true"
              data-brand-header-bg="1"
              className="pointer-events-none absolute inset-0 -z-10 bg-[#0C0C0E]"
            />
            <div className="mx-auto flex max-w-lg items-center justify-center px-4 pb-2 pt-0">
              <div data-cold-launch-target="compact">
                <BrandMark variant="compact" />
              </div>
            </div>
          </div>
        </header>
      ) : null}

      <main
        ref={mainRef}
        className={`relative z-10 min-h-0 w-full flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
          chromeHidden ? 'max-w-none' : ''
        }`}
        style={
          chromeHidden
            ? { paddingBottom: 0 }
            : {
                paddingBottom:
                  bottomNavObscured
                    ? '1.5rem'
                    : isBarVisible
                      ? `calc(var(--app-bottom-nav) + ${REST_BAR_CONTENT_PAD} + var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 1.75rem)`
                      : 'calc(var(--app-bottom-nav) + var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 1.75rem)',
              }
        }
        aria-hidden={streakCelebrationActive ? true : undefined}
        data-app-scroll-main="1"
      >
        <div
          className={
            chromeHidden ? undefined : 'mx-auto w-full max-w-lg px-5 py-8'
          }
          style={
            chromeHidden || showHeader
              ? undefined
              : {
                  /* Pas de barre marque : le contenu gère l’encoche iOS (safe-area). */
                  paddingTop: 'max(2rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
                }
          }
        >
          {children}
        </div>
      </main>

      {!chromeHidden ? (
        <>
          <RestTimerOverlay
            showReadyBar={showReadyBar}
            state={state}
            onPreset={(sec: RestPresetSec) => {
              const target = state.target ?? {
                exerciseId: 'quick-rest',
                setIndex: 0,
                exerciseName: 'Repos libre',
                setLabel: `${sec}s`,
              }
              start(sec, {
                ...target,
                setLabel: target.exerciseId === 'quick-rest' ? `${sec}s` : target.setLabel,
              })
            }}
            onSkip={skip}
            onDismiss={dismiss}
            onPause={pause}
            onResume={resume}
          />
          {showBottomNav ? (
            <div
              data-bottom-nav-host
              className={bottomNavObscured ? 'pointer-events-none invisible' : undefined}
              inert={bottomNavObscured ? true : undefined}
              aria-hidden={bottomNavObscured ? true : undefined}
            >
              <BottomNav
                activeTab={activeTab}
                onTabChange={onTabChange}
                onStartTraining={onStartTraining}
                hasActiveWorkout={hasActiveWorkout}
                compact={bottomNavMode === 'compact'}
                onExpand={expand}
              />
            </div>
          ) : null}
        </>
      ) : null}
      <StreakCelebrationHost shellRef={shellRef} />
    </div>
  )
}
