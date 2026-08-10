export { processScheduledQueryTemplate } from './template-processor.js'
export { UPDATE_COSTS_AND_CALCULATE_ATTRIBUTION_TEMPLATE } from './templates/index.js'
export type {
  IScheduledQueryTemplateVariables,
  IScheduledQueryConfig,
} from './scheduled-queries.interface.js'

export const SCHEDULED_QUERY_CONFIGS = {
  updateCostsAndCalculateAttribution: {
    displayNamePrefix: 'sx_@PROJECT_ID_update_costs_and_calculate_attribution',
    templateName: 'update-costs-and-calculate-attribution',
    schedule: 'every 6 hours',
  },
} as const

/**
 * Display names легаси scheduled queries, существовавших до объединения всех
 * джоб в одну (отдельные кост-джобы + отдельная атрибуция). Деплой находит их
 * по этим именам у существующих проектов и удаляет, чтобы пересчёты не шли
 * дважды параллельно с единой джобой.
 */
export const LEGACY_SCHEDULED_QUERY_DISPLAY_NAME_PREFIXES = [
  'sx_@PROJECT_ID_calculate_events_attribution',
  'sx_@PROJECT_ID_facebook_ads_ad_costs_update',
  'sx_@PROJECT_ID_google_ads_ad_costs_update',
  'sx_@PROJECT_ID_tiktok_ads_ad_costs_update',
] as const
