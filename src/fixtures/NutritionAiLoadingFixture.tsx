import { MealPhotoAiOverlay } from '../components/nutrition/MealPhotoAiOverlay'

/** Route `/nutrition-ai-loading-fixture` — overlay d’analyse photo IA, sans réseau. */
export function NutritionAiLoadingFixture() {
  return (
    <div className="min-h-[100dvh] bg-[#0C0C0E] text-white">
      <div className="px-5 py-8">
        <h1 className="text-[22px] font-bold tracking-tight">Nutrition</h1>
        <p className="mt-2 text-[14px] text-[#8E8E93]">Scan Photo IA en cours…</p>
      </div>
      <MealPhotoAiOverlay open previewUrl={null} />
    </div>
  )
}
