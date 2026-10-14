/**
 * Point d’entrée « Ajouter un aliment » (v3).
 * Les écrans parents choisissent Legacy vs V3 via VITE_ENABLE_FOOD_ADD_V3.
 */
export { AddFoodScreenV3 as AddFoodScreen } from './AddFoodScreenV3'
export { AddFoodScreenV3 } from './AddFoodScreenV3'
export { AddFoodScreenLegacy } from './AddFoodScreenLegacy'
export type { FoodCategoryId } from '../../utils/foodCategories'
