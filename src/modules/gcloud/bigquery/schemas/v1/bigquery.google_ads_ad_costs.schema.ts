export const GOOGLE_ADS_AD_COSTS_TABLE_ID = 'google_ads_ad_costs'

export const GOOGLE_ADS_AD_COSTS_TABLE_SCHEMA = [
  { name: 'inserted_at', type: 'INTEGER' },
  { name: 'date', type: 'DATE' },
  { name: 'ad_account_id', type: 'STRING' },
  { name: 'timezone', type: 'STRING' },
  { name: 'source', type: 'STRING' },
  { name: 'medium', type: 'STRING' },
  { name: 'campaign', type: 'STRING' },
  { name: 'content', type: 'STRING' },
  { name: 'term', type: 'STRING' },
  { name: 'strimix_refid', type: 'STRING' },
  { name: 'landing_page_url', type: 'STRING' },
  { name: 'landing_hostname', type: 'STRING' },
  { name: 'landing_page_path', type: 'STRING' },
  {
    name: 'url_params',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: [
      { name: 'key', type: 'STRING' },
      {
        name: 'value',
        type: 'RECORD',
        fields: {
          name: 'string_value',
          type: 'STRING',
        },
      },
    ],
  },
  { name: 'cost', type: 'FLOAT' },
  { name: 'currency', type: 'STRING' },
  { name: 'impressions', type: 'INTEGER' },
  { name: 'reach', type: 'INTEGER' },
  { name: 'clicks', type: 'INTEGER' },
  { name: 'click_delay', type: 'BOOLEAN' },
  { name: 'ad_id', type: 'STRING' },
  { name: 'keyword', type: 'STRING' },
]
