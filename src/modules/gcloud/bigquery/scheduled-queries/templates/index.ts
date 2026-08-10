import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Единая джоба проекта: последовательно обновляет расходы всех рекламных
 * коннекторов (Facebook / Google / TikTok / ручные из Google Sheets) и затем
 * запускает атрибуцию и классификацию трафика по свежему снимку ad_costs.
 * Деплоится как одна scheduled query (раздел 11 ТЗ).
 */
export const UPDATE_COSTS_AND_CALCULATE_ATTRIBUTION_TEMPLATE = readFileSync(
  join(__dirname, 'update-costs-and-calculate-attribution.sql'),
  'utf-8',
)
