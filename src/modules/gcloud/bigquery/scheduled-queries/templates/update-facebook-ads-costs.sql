begin

declare _project_name string default '@GCP_PROJECT_NAME';
declare _dataset_name string default '@GPC_BQ_DATASET_NAME';

-- Process Facebook Ads
begin

declare query string;
declare query_template string;

-- Delete all costs
set query_template = """
delete from `<project_name>.<dataset_name>.ad_costs`
where data_source = 'FACEBOOK_ADS'
""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

-- Insert updated costs
set query_template = """
insert into `<project_name>.<dataset_name>.ad_costs` (
  date,
  ad_platform,
  source,
  medium,
  campaign,
  content,
  term,
  strimix_refid,
  landing_page_url, 
  landing_hostname, 
  landing_page_path,
  url_params,
  cost,
  currency,
  impressions,
  reach,
  clicks,
  click_delay,
  data_source,
  campaign_id,
  campaign_name,
  adgroup_id,
  adgroup_name,
  ad_id,
  ad_name,
  creative_image_url
)

with 
-- Create match keys by date, utms, ad_id
source_match_keys as (
  select
    concat(
      cast(date as string),
      ad_account_id,
      ifnull(trim(source), '_'),
      ifnull(trim(medium), '_'),
      ifnull(trim(campaign), '_'),
      ifnull(trim(content), '_'),
      ifnull(trim(term), '_'),
      ifnull(trim(strimix_refid), '_')
    , ad_id) match_key,
    *
  from `<project_name>.<dataset_name>.facebook_ads_ad_costs`
), 

-- Set match keys row ordering numbers
ordered_match_keys as (
  select row_number() over (partition by ad_id, date order by inserted_at asc) row_number, * from source_match_keys
), 

-- Detect ads with changed utms
-- (to avoid ad cost duplication case when ad had utms A-value on the first download and then user changed utms to B-value on next download day)
find_ads_with_changed_utms as (
  select
    case when
      lead(match_key) over(partition by ad_id, date order by inserted_at asc) != match_key
      then row_number
      else null end primary_utm_row_number,
    match_key,
    ad_id,
    date
  from ordered_match_keys
),

ads_with_changed_utms as (
  select * from find_ads_with_changed_utms
  where primary_utm_row_number is not null
),

-- Set source rows numbers for ad metrics
ads_with_changed_utms_filtered as (
  select 
    first_value(primary_utm_row_number) over(partition by ad_id, date order by primary_utm_row_number asc) last_row,
    date,
    ad_id,
    first_value(match_key) over(partition by ad_id, date order by primary_utm_row_number asc) match_key
  from ads_with_changed_utms
),

ads_with_changed_utms_grouped as (
  select * from ads_with_changed_utms_filtered
  group by last_row, date, ad_id, match_key
),

latest_matched_rows as (
  select 
    if(
      match_key in (select i.match_key from ads_with_changed_utms_grouped i where i.match_key = t1.match_key),
      (select i.last_row from ads_with_changed_utms_grouped i where i.match_key = t1.match_key),
      if((select i.last_row from ads_with_changed_utms_grouped i where i.date = t1.date and i.ad_id = t1.ad_id) is null, max(row_number) over(partition by date, ad_id), null)
    ) last_row,
    * except(row_number, inserted_at, timezone, landing_page_url, landing_hostname, landing_page_path, url_params, cost, currency, impressions, reach, clicks, click_delay) 
  from ordered_match_keys t1
),

-- Group source rows
latest_matched_rows_grouped as (
  select * from latest_matched_rows
  where last_row is not null
  group by match_key, date, ad_account_id, source, medium, campaign, content, term, strimix_refid, last_row, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, creative_image_url
),

-- Saturate ad costs by utms
rows_with_actual_utms as (
  select
    b.row_number,
    b.match_key,
    c.date, 
    c.source, 
    c.medium, 
    c.campaign, 
    c.content, 
    c.term, 
    c.strimix_refid, 
    b.landing_page_url, 
    b.landing_hostname, 
    b.landing_page_path,
    b.cost, 
    b.currency, 
    b.impressions, 
    b.reach, 
    b.clicks, 
    b.click_delay, 
    'FACEBOOK_ADS' data_source,
    c.campaign_id,
    c.campaign_name,
    c.adset_id,
    c.adset_name,
    c.ad_id,
    c.ad_name,
    c.creative_image_url
  from latest_matched_rows_grouped c
  inner join ordered_match_keys b
  on b.row_number = c.last_row
  and b.match_key = c.match_key
), 

-- Saturate ad costs by actual metric values
ad_costs as (
  select 
    d.date,
    'Facebook Ads' ad_platform,
    d.source,
    d.medium,
    d.campaign,
    d.content,
    d.term,
    d.strimix_refid,
    d.landing_page_url,
    d.landing_hostname,
    d.landing_page_path,
    b.url_params,
    d.cost,
    d.currency,
    d.impressions,
    d.reach,
    d.clicks,
    d.click_delay,
    d.data_source,
    d.campaign_id,
    d.campaign_name,
    d.adset_id adgroup_id,
    d.adset_name adgroup_name,
    d.ad_id,
    d.ad_name,
    d.creative_image_url
  from rows_with_actual_utms d
  left join ordered_match_keys b
  on b.row_number = d.row_number
  and b.match_key = d.match_key
)

select * from ad_costs""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

end;

end;