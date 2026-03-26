import { readFileSync } from 'fs'
import { join } from 'path'

export const CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE = readFileSync(
  join(__dirname, 'calculate-events-attribution.sql'),
  'utf-8',
)

export const UPDATE_FACEBOOK_ADS_AD_COSTS_TEMPLATE = readFileSync(
  join(__dirname, 'update-facebook-ads-costs.sql'),
  'utf-8',
)

export const UPDATE_GOOGLE_ADS_AD_COSTS_TEMPLATE = readFileSync(
  join(__dirname, 'update-google-ads-costs.sql'),
  'utf-8',
)

export const UPDATE_TIKTOK_ADS_AD_COSTS_TEMPLATE = readFileSync(
  join(__dirname, 'update-tiktok-ads-costs.sql'),
  'utf-8',
)
