import { readFileSync } from 'fs'
import { join } from 'path'

export const CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE = readFileSync(
  join(__dirname, 'calculate-events-attribution.sql'),
  'utf-8',
)
