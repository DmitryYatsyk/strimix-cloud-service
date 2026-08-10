export const EXCLUDED_REFERRERS_TABLE_ID = 'excluded_referrers'

/**
 * Per-project list of referrer hosts excluded from referral attribution
 * (self-referrals / own domains that must not count as referral traffic).
 *
 * Shape kept as a single REPEATED `hosts` column so the attribution job's
 * `unnest(hosts)` stays unchanged. Client-owned: created empty at deploy,
 * then edited via SQL / future UI (INSERT/UPDATE/DELETE on the array row,
 * or replace the row wholesale).
 */
export const EXCLUDED_REFERRERS_TABLE_SCHEMA = [{ name: 'hosts', type: 'STRING', mode: 'REPEATED' }]
