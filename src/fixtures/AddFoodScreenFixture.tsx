import { useMemo, useState, type FormEvent } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { AddFoodScreen } from '../components/nutrition/AddFoodScreen'
import type { OpenFoodFactsSearchHit } from '../services/alimentsService'
import type { FoodCategoryId } from '../utils/foodCategories'
import { hitMatchesFoodCategory } from '../utils/foodCategories'
import type { MealType } from '../types/nutrition'

const FIXTURE_HITS: OpenFoodFactsSearchHit[] = [
  {
    barcode: 'a1',
    nom: 'BANANE BIO 250g',
    brands: 'Bio',
    calories: 89,
    proteines: 1.1,
    glucides: 23,
    lipides: 0.3,
    imageUrl: 'https://images.openfoodfacts.org/images/products/banane.png',
    servingSize: '1 serving (120g)',
    categoriesTags: ['en:fruits', 'en:fresh-fruits'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 'a2',
    nom: 'Pomme Golden',
    brands: '',
    calories: 52,
    proteines: 0.3,
    glucides: 14,
    lipides: 0.2,
    imageUrl: 'https://images.openfoodfacts.org/images/products/pomme.png',
    servingSize: '150g',
    categoriesTags: ['en:fruits'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 'b1',
    nom: 'Eau minérale',
    brands: 'Source',
    calories: 0,
    proteines: 0,
    glucides: 0,
    lipides: 0,
    servingSize: '250 ml',
    categoriesTags: ['en:beverages', 'en:waters'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 'b2',
    nom: 'Jus d’orange',
    brands: 'Pressé',
    calories: 45,
    proteines: 0.7,
    glucides: 10,
    lipides: 0.1,
    servingSize: '200 ml',
    categoriesTags: ['en:beverages'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 'd1',
    nom: 'YAOURT NATURE',
    brands: 'Laiterie',
    calories: 65,
    proteines: 4,
    glucides: 5,
    lipides: 3,
    servingSize: '125 g',
    categoriesTags: ['en:dairies', 'en:yogurts'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 's1',
    nom: 'Chips nature',
    brands: 'Crunch',
    calories: 530,
    proteines: 6,
    glucides: 50,
    lipides: 34,
    servingSize: '30g',
    categoriesTags: ['en:snacks', 'en:salty-snacks'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
  {
    barcode: 'm1',
    nom: 'Salade César',
    brands: '',
    calories: 180,
    proteines: 12,
    glucides: 8,
    lipides: 11,
    servingSize: '1 serving (250g)',
    categoriesTags: ['en:meals', 'en:prepared-meals'],
    provenance: 'open_food_facts',
    fetchedAt: 1,
  },
]

/**
 * Fixture plein écran pour capture / démo « Ajouter un aliment » v3.
 * Query: ?fixture=add-food  (&offline=1 pour icônes neutres)
 */
export function AddFoodScreenFixture() {
  const params = new URLSearchParams(window.location.search)
  const forceOffline = params.get('offline') === '1'
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategoryId>('all')
  const [name, setName] = useState('')
  const [calories, setCalories] = useState(350)
  const [proteinG, setProteinG] = useState<number | ''>('')
  const [carbsG, setCarbsG] = useState<number | ''>('')
  const [fatG, setFatG] = useState<number | ''>('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [validated, setValidated] = useState<string | null>(null)

  const hits = useMemo(() => {
    const term = query.trim().toLowerCase()
    let list = FIXTURE_HITS.filter((h) => hitMatchesFoodCategory(category, h.categoriesTags))
    if (term.length >= 2) {
      list = list.filter(
        (h) =>
          h.nom.toLowerCase().includes(term) ||
          h.brands.toLowerCase().includes(term),
      )
    }
    return list
  }, [query, category])

  const onSubmitManual = (event: FormEvent) => {
    event.preventDefault()
    setValidated(`manual:${name}`)
  }

  return (
    <AuthProvider>
      <div className="min-h-[100dvh] bg-[#0C0C0E] text-white">
        {validated ? (
          <p className="p-4 text-[13px] text-[#30D158]" data-fixture-validated>
            Validé : {validated}
          </p>
        ) : null}
        <AddFoodScreen
          searchQuery={query}
          onSearchQueryChange={setQuery}
          searchLoading={false}
          searchError={null}
          searchHits={hits}
          category={category}
          onCategoryChange={setCategory}
          onValidateSelection={(selected) => {
            setValidated(selected.map((h) => h.nom).join(' · '))
          }}
          onOpenScanner={() => setValidated('scanner')}
          onToast={() => undefined}
          onPhotoAnalyzed={() => setValidated('photo-ia')}
          name={name}
          onNameChange={setName}
          calories={calories}
          onCaloriesChange={setCalories}
          proteinG={proteinG}
          onProteinChange={setProteinG}
          carbsG={carbsG}
          onCarbsChange={setCarbsG}
          fatG={fatG}
          onFatChange={setFatG}
          mealType={mealType}
          onMealTypeChange={setMealType}
          onSubmitManual={onSubmitManual}
          onClose={() => setValidated('closed')}
          forceOfflineImages={forceOffline}
        />
      </div>
    </AuthProvider>
  )
}
