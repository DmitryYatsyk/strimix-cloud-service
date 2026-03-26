export { processScheduledQueryTemplate } from './template-processor.js'
export { CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE } from './templates/index.js'
export type {
  IScheduledQueryTemplateVariables,
  IScheduledQueryConfig,
} from './scheduled-queries.interface.js'

export const SCHEDULED_QUERY_CONFIGS = {
  calculateEventsAttribution: {
    displayNamePrefix: 'sx_@PROJECT_ID_calculate_events_attribution',
    templateName: 'calculate-events-attribution',
    schedule: 'every 6 hours',
  },
  facebookAdsAdCostsUpdate: {
    displayNamePrefix: 'sx_@PROJECT_ID_facebook_ads_ad_costs_update',
    templateName: 'update-facebook-ads-costs',
    schedule: 'every 6 hours',
  },
  googleAdsAdCostsUpdate: {
    displayNamePrefix: 'sx_@PROJECT_ID_google_ads_ad_costs_update',
    templateName: 'update-google-ads-costs',
    schedule: 'every 6 hours',
  },
  tiktokAdsAdCostsUpdate: {
    displayNamePrefix: 'sx_@PROJECT_ID_tiktok_ads_ad_costs_update',
    templateName: 'update-tiktok-ads-costs',
    schedule: 'every 6 hours',
  },
} as const
