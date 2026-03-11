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
} as const
