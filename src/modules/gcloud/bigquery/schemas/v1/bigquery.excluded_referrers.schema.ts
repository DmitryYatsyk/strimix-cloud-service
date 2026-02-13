export const EXCLUDED_REFERRERS_TABLE_ID = 'excluded_referrers'

export const EXCLUDED_REFERRERS_TABLE_SCHEMA = [{ name: 'hosts', type: 'STRING', mode: 'REPEATED' }]

export const EXCLUDED_REFERRERS_VIEW_QUERY = `select ['https://some-site.com/'] as hosts`
