import { saveAliment, type OpenFoodFactsProduct } from '../../services/alimentsService'
import { toUserFacingError } from '../../utils/userFacingError'

export async function persistScannedProductSelection(
  product: OpenFoodFactsProduct,
  userId: string | null | undefined,
  onError: (message: string) => void,
): Promise<boolean> {
  if (!userId) return false
  try {
    await saveAliment(product, userId)
    return true
  } catch (error) {
    onError(toUserFacingError(error, 'Impossible d’enregistrer cet aliment.'))
    return false
  }
}
