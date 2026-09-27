import { AuthStateProvider } from '../context/AuthContext'
import { MealPhotoAnalyzer } from '../components/nutrition/MealPhotoAnalyzer'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../test/authFixtureValue'

const OVERLOAD_MESSAGE = 'IA surchargée, réessaie dans un instant ; le quota n’est pas consommé.'

export function NutritionAiErrorFixture() {
  const authValue = buildAuthContextValue({
    user: FIXTURE_AUTH_USER,
    isAuthenticated: true,
  })

  return (
    <AuthStateProvider value={authValue}>
      <div className="min-h-[100dvh] bg-[#0C0C0E] px-5 py-8 text-white">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="mb-4 text-[22px] font-bold tracking-tight text-white">Nutrition</h1>
          <MealPhotoAnalyzer
            forcedErrorMessage={OVERLOAD_MESSAGE}
            onAnalyzed={() => undefined}
            onToast={() => undefined}
          />
        </div>
      </div>
    </AuthStateProvider>
  )
}
