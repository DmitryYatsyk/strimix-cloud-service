begin

declare _project_name string default '@GCP_PROJECT_NAME';
declare _dataset_name string default '@GPC_BQ_DATASET_NAME';
declare _project_timezone string default '"@PROJECT_TIMEZONE"';

create temporary function decode_uri_component(path string)
returns string
language js as """
if (path == null) return null;
try {
  return decodeURIComponent(path);
} catch (e) {
  return path;
}
""";

------------------------------------------
--------- 1. CREATE BOT IP LIST ----------
------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create temp table `bot_ip` as(
  select distinct(device_info.ip) ip
  from `<project_name>.<dataset_name>.identified_events`
  where
  -- Exclude events by bot network number
  regexp_extract(device_info.ip, r'^(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)') in 
    (select distinct(regexp_extract(ip, r'^(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)')) from `bi-200.service_eu.web_bots_list`
    where bot like '%facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)%'
    or bot like '%Googlebot%'
    /*or bot like '%YandexBot%' - Temporary disable - needs more clean bot IP list*/
    or bot like '%Applebot%')
)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

end;

-------------------------------------------------------------------------------
---- 2. DELETE DUPLICATED EVENTS AND RE-IDENTIFY PROFILES AT SESSION LEVEL ----
-------------------------------------------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create temp table `identified_events` as(
with delete_duplicated_events as (
  select * except(row_number)
  from (
    select
      *, row_number() over (partition by event_id) as row_number
    from `<project_name>.<dataset_name>.identified_events`
  )
  where row_number = 1
  -- Exclude bot traffic by User Agent
  and (
    (device_info.web_info.user_agent not like '%facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)%'
    and device_info.web_info.user_agent not like '%Googlebot%'
    and device_info.web_info.user_agent not like '%YandexBot%'
    and device_info.web_info.user_agent not like '%Applebot%')
    or device_info.web_info.user_agent is null)
  -- Exclude bot traffic by IP
  and (device_info.ip is null or device_info.ip not in (select * from bot_ip))
),

-- Re-identify events at session level
detect_latest_session_profile_id as (
  select
    -- If strimix_avid exists find last session profile_id
    if(strimix_avid is not null,
      -- If between the current and a next event more than 45 minutes - set current profile_id as the latest in session
      case when lead(timestamp) over(partition by strimix_avid order by timestamp asc) - timestamp > 2700000 then profile_id
      -- If the event is the last in strimix_avid partition
      else case when lead(event_id) over(partition by strimix_avid order by timestamp asc) is null then profile_id
      -- If next event exists
      else null end end
    -- If strimix_avid is null pass original profile_id
    , profile_id) latest_session_profile_id,
    *
  from delete_duplicated_events
),

-- Rewrite profile_id
raw_events_with_overridden_profile_id as (
  select
    -- If strimix_avid exists set last session profile_id
    if(strimix_avid is not null,
      -- Spread last session profile_id within strimix_avid partition
      first_value(latest_session_profile_id ignore nulls) over(partition by strimix_avid order by timestamp asc rows between current row and unbounded following)
    -- If strimix_avid is null set original profile_id
    , profile_id) profile_id,
    * except(profile_id, latest_session_profile_id)
  from detect_latest_session_profile_id
)

select * from raw_events_with_overridden_profile_id)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

end;

--------------------------------------------------------------------------
----------------------- 3. UPDATE PAGE VIEWS TABLE -----------------------
--------------------------------------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create or replace table `<project_name>.<dataset_name>.page_views`
partition by date options (require_partition_filter = false) as(
-- Satrurate page_views by utms and page_view params
with t1 as (
  select
    timestamp,
    profile_id,
    event_id,
    (select value.string_value from unnest(event_params) where key like 'page_location') as page_location,
    regexp_extract((select value.string_value from unnest(event_params) where key like 'page_location'), r'(?:[a-za-z]+://)?([a-za-z0-9-.]+)/?') as host,
    regexp_extract((select value.string_value from unnest(event_params) where key like 'page_location'), r'(?:[a-za-z]+://)?(?:[a-za-z0-9-.]+)/{1}([a-za-z0-9-./]+)') as path,
    regexp_extract((select value.string_value from unnest(event_params) where key like 'page_location'), r'\\?(.*)') as query,
    (select value.string_value from unnest(event_params) where key like 'page_referrer') as page_referrer,
    (select regexp_extract(value.string_value, r'(?:[a-za-z]+://)?([a-za-z0-9-.]+)/?') from unnest(event_params) where key like 'page_referrer') as page_referrer_host,
    trim((select value.string_value from unnest(event_params) where key like 'source')) as source,
    trim((select value.string_value from unnest(event_params) where key like 'medium')) as medium,
    trim((select value.string_value from unnest(event_params) where key like 'campaign')) as campaign,
    trim((select value.string_value from unnest(event_params) where key like 'content')) as content,
    trim((select value.string_value from unnest(event_params) where key like 'term')) as term,
    trim((select value.string_value from unnest(event_params) where key like 'strimix_refid')) as strimix_refid,
    device_info,
  from `identified_events` as t1
  where event_name like 'page_view'
),

-- Set source/medium marks
t2 as (
  select
    timestamp,
    profile_id,
    event_id,
    page_location,
    host,
    path,
    query,
    page_referrer,
    page_referrer_host,
    case 
      when source is not null then source
      else case 
        when page_referrer is not null 
        and page_referrer_host not like host 
        and page_referrer_host not in (select host from `<project_name>.<dataset_name>.excluded_referrers`, unnest(hosts) as host)
        and medium is null
        then if(regexp_contains(page_referrer, r'^android-app:\\/\\/'), page_referrer, page_referrer_host)
      else case when medium is not null then '(not set)'
      else '(direct)' end end end as source,
    case 
      when medium is not null then medium 
      else case 
        when page_referrer is not null 
        and page_referrer_host not like host 
        and page_referrer_host not in (select host from `<project_name>.<dataset_name>.excluded_referrers`, unnest(hosts) as host)
        and source is null
        then 'referral'
      else case when source is not null then '(not set)'
      else '(none)' end end end as medium,
    campaign,
    content,
    term,
    strimix_refid,
    split(query, '&') url_params,
    device_info,
  from t1
)

-- Add page_view attr types to page_view event
select
  extract(date from timestamp_millis(timestamp) at time zone <project_timezone>) date,
  timestamp,
  profile_id,
  page_location,
  host,
  path,
  page_referrer,
  page_referrer_host,
  event_id as page_view_event_id,
  source,
  medium,
  campaign,
  content,
  term,
  strimix_refid,
  array(
      select as struct 
        decode_uri_component(regexp_extract(up, r'(.*)\\=')) as key,
        struct(decode_uri_component(regexp_extract(up, r'\\=(.*)')) as string_value) as value
      from unnest(t2.url_params) as up
  ) url_params,
  device_info,
from t2)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);
set query = replace(query, '<project_timezone>', _project_timezone);

execute immediate (query);

end;

-- -------------------------------------------
-- ----------- PROCESS UTM ALIASES -----------
-- -------------------------------------------
-- begin

-- declare query string;
-- declare query_template string;

-- set query_template = """
-- create temp table `aliases_count` as(
--   select count(alias_hash) value from `<project_name>.<dataset_name>.utm_aliases`
-- )""";

-- set query = replace(query_template, '<project_name>', _project_name);
-- set query = replace(query, '<dataset_name>', _dataset_name);

-- execute immediate (query);

-- if ((select value from aliases_count) > 0) then
-- -------------------------------------------
-- ------- 1. CREATE UTM ALIASES TABLE -------
-- -------------------------------------------

-- set query_template = """
-- create temp table `page_views_to_replace_alias` as(
--   select
--     p.page_view_event_id,
--     if(a.source.alias.mode = 'value', a.source.alias.value, p.source) source,
--     if(a.medium.alias.mode = 'value', a.medium.alias.value, p.medium) medium,
--     if(a.campaign.alias.mode = 'value', a.campaign.alias.value, p.campaign) campaign,
--     if(a.content.alias.mode = 'value', a.content.alias.value, p.content) content,
--     if(a.term.alias.mode = 'value', a.term.alias.value, p.term) term
--   from `<project_name>.<dataset_name>.utm_aliases` a
--   inner join `<project_name>.<dataset_name>.page_views` p
--   on if(a.source.filter.mode = 'value', a.source.filter.value = p.source, if(a.source.filter.mode = 'origin', true, false))
--   and if(a.medium.filter.mode = 'value', a.medium.filter.value = p.medium, if(a.medium.filter.mode = 'origin', true, false))
--   and if(a.campaign.filter.mode = 'value', a.campaign.filter.value = p.campaign, if(a.campaign.filter.mode = 'origin', true, false))
--   and if(a.content.filter.mode = 'value', a.content.filter.value = p.content, if(a.content.filter.mode = 'origin', true, false))
--   and if(a.term.filter.mode = 'value', a.term.filter.value = p.term, if(a.term.filter.mode = 'origin', true, false))
-- )""";

-- set query = replace(query_template, '<project_name>', _project_name);
-- set query = replace(query, '<dataset_name>', _dataset_name);

-- execute immediate (query);

-- ----------------------------------------------
-- ---- 2. REPLACE UTM ALIASES IN PAGE VIEWS ----
-- ----------------------------------------------

-- set query_template = """
-- update `<project_name>.<dataset_name>.page_views` p
-- set source = (select source from page_views_to_replace_alias a where a.page_view_event_id = p.page_view_event_id),
-- medium = (select medium from page_views_to_replace_alias a where a.page_view_event_id = p.page_view_event_id),
-- campaign = (select campaign from page_views_to_replace_alias a where a.page_view_event_id = p.page_view_event_id),
-- content = (select content from page_views_to_replace_alias a where a.page_view_event_id = p.page_view_event_id),
-- term = (select term from page_views_to_replace_alias a where a.page_view_event_id = p.page_view_event_id)
-- where page_view_event_id in (select page_view_event_id from page_views_to_replace_alias)""";

-- set query = replace(query_template, '<project_name>', _project_name);
-- set query = replace(query, '<dataset_name>', _dataset_name);

-- execute immediate (query);

-- end if;

-- end;

--------------------------------------------------------------------------
------------------------- 4. UPDATE VISITS TABLE -------------------------
--------------------------------------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
-- Create visits table
create or replace table `<project_name>.<dataset_name>.visits`
partition by date options (require_partition_filter = false) as (
-- Select all browser events
with browser_events as (
  select
    timestamp,
    event_id,
    profile_id,
  from `identified_events`
  where device_info.web_info.user_agent is not null
),

-- Merge page_views attribution (page_view_event_id, source, medium, campaign, content, term, strimix_refid) to all events table
browser_events_with_utms_attr as (
  select
    t1.timestamp,
    t1.event_id,
    t1.profile_id,
    t2.page_view_event_id,
    t2.source,
    t2.medium,
    t2.campaign,
    t2.content,
    t2.term,
    t2.strimix_refid,
    t2.url_params,
    t2.host,
    t2.path,
    t2.page_location,
    t2.page_referrer_host,
    t2.device_info,
  from browser_events as t1
  left join `<project_name>.<dataset_name>.page_views` as t2
  on t1.event_id = t2.page_view_event_id
),

-- Saturate table with visit_id
browser_events_with_visit_id as (
  select
    timestamp,
    event_id,
    profile_id,
    page_view_event_id,
    -- Если событие page_view
    case when page_view_event_id is not null then 
      -- И его источник непрямой и реферал не является сайтом клиента (например возврат в истории браузера на предыдующую страницу на которой были ютм-метки) - генерируем новый visit_id
      case when source != '(direct)' and (page_referrer_host is null or page_referrer_host != host) then generate_uuid()
      -- В любом другом случае
      else
        -- И между текущим и прошлым событием задержка больше 45 минут: генерируем новый visit_id
        case when timestamp - lag(timestamp) over(partition by profile_id order by timestamp asc) > 2700000 then generate_uuid()
        -- И прошлого события нет (это первое событие у данного profile_id): генерируем новый visit_id
        else case when lag(event_id) over(partition by profile_id order by timestamp asc) is null then generate_uuid()
        -- И во всех прошлых событиях нет page_view (это первое событие page_view у данного profile_id): генерируем новый visit_id
        else case when last_value(page_view_event_id ignore nulls) over(partition by profile_id order by timestamp rows between unbounded preceding and 1 preceding) is null then generate_uuid()
    end end end end end visit_id,
    source,
    medium,
    campaign,
    content,
    term,
    strimix_refid,
    url_params,
    host,
    path,
    page_location,
    page_referrer_host,
    -- Если событие page_view
    case when page_view_event_id is not null then
      -- И между текущим и следующим событием задержка больше 45 минут: определяем его как последний page_view визита
      case when timestamp - lead(timestamp) over(partition by profile_id order by timestamp asc) > 2700000 then host
      -- И будущего события нет (это последнее событие у данного profile_id): определяем его как последний page_view визита
      else case when lead(event_id) over(partition by profile_id order by timestamp asc) is null then host
      -- И во всех будущих событиях нет page_view (это крайнее событие page_view у данного profile_id): определяем его как последний page_view визита
      else case when last_value(page_view_event_id ignore nulls) over(partition by profile_id order by timestamp rows between 1 following and unbounded following) is null then host
    end end end end last_hostname,
    -- Если событие page_view
    case when page_view_event_id is not null then
      -- И между текущим и следующим событием задержка больше 45 минут: определяем его как последний page_view визита
      case when timestamp - lead(timestamp) over(partition by profile_id order by timestamp asc) > 2700000 then path
      -- И будущего события нет (это последнее событие у данного profile_id): определяем его как последний page_view визита
      else case when lead(event_id) over(partition by profile_id order by timestamp asc) is null then path
      -- И во всех будущих событиях нет page_view (это крайнее событие page_view у данного profile_id): определяем его как последний page_view визита
      else case when last_value(page_view_event_id ignore nulls) over(partition by profile_id order by timestamp rows between 1 following and unbounded following) is null then path
    end end end end last_page_path,
    -- Если событие page_view
    case when page_view_event_id is not null then
      -- И между текущим и следующим событием задержка больше 45 минут: определяем его как последний page_view визита
      case when timestamp - lead(timestamp) over(partition by profile_id order by timestamp asc) > 2700000 then page_location
      -- И будущего события нет (это последнее событие у данного profile_id): определяем его как последний page_view визита
      else case when lead(event_id) over(partition by profile_id order by timestamp asc) is null then page_location
      -- И во всех будущих событиях нет page_view (это крайнее событие page_view у данного profile_id): определяем его как последний page_view визита
      else case when last_value(page_view_event_id ignore nulls) over(partition by profile_id order by timestamp rows between 1 following and unbounded following) is null then page_location
    end end end end last_page_url,
    device_info,
  from browser_events_with_utms_attr
),

-- Create visits table
browser_events_with_last_page_info as (
  select
    extract(date from timestamp_millis(t1.timestamp) at time zone <project_timezone>) date,
    t1.timestamp,
    t1.profile_id,
    t1.visit_id,
    if (t1.source not like '(direct)' and (t1.page_referrer_host is null or t1.page_referrer_host != t1.host), t1.visit_id, null) as non_direct_visit_id,
    if (t1.source not like '(direct)' and t1.medium not like 'referral' and (t1.page_referrer_host is null or t1.page_referrer_host != t1.host), t1.visit_id, null) as marked_visit_id,
    t1.event_id,
    t1.source,
    t1.medium,
    t1.campaign,
    t1.content,
    t1.term,
    t1.strimix_refid,
    t1.url_params,
    t1.host first_hostname,
    t1.path first_page_path,
    t1.page_location first_page_url,
    first_value(t2.last_hostname ignore nulls) over(partition by t2.profile_id order by t2.timestamp rows between current row and unbounded following) last_hostname,
    first_value(t2.last_page_path ignore nulls) over(partition by t2.profile_id order by t2.timestamp rows between current row and unbounded following) last_page_path,
    first_value(t2.last_page_url ignore nulls) over(partition by t2.profile_id order by t2.timestamp rows between current row and unbounded following) last_page_url,
    t1.device_info,
  from browser_events_with_visit_id t1
  left join browser_events_with_visit_id t2
  on t1.profile_id = t2.profile_id
  and t2.last_hostname is not null
  where t1.visit_id is not null
),

visits_table as (
  select
    extract(date from timestamp_millis(timestamp) at time zone <project_timezone>) date,
    timestamp,
    profile_id,
    visit_id,
    case when first_value(visit_id) over(partition by profile_id order by timestamp asc rows between unbounded preceding and current row) = visit_id then true else false end is_first_visit,
    non_direct_visit_id,
    marked_visit_id,
    event_id as first_event_id,
    source,
    medium,
    campaign,
    content,
    term,
    strimix_refid,
    array_concat(
      url_params,
      [
        struct( 
          'visit_device_category' as key,
          struct(
            if(device_info.category is null, '(empty)', device_info.category) as string_value
          ) as value
        ),
        struct( 
          'visit_device_operating_system' as key,
          struct(
            if(device_info.operating_system is null, '(empty)', device_info.operating_system) as string_value
          ) as value
        ),
        struct( 
          'visit_device_operating_system_version' as key,
          struct(
            if(device_info.operating_system_version is null, '(empty)', device_info.operating_system_version) as string_value
          ) as value
        ),
        struct( 
          'visit_device_timezone' as key,
          struct(
            if(device_info.timezone is null, '(empty)', device_info.timezone) as string_value
          ) as value
        ),
        struct( 
          'visit_device_language' as key,
          struct(
            if(device_info.language is null, '(empty)', device_info.language) as string_value
          ) as value
        ),
        struct( 
          'first_hostname' as key,
          struct(
            if(first_hostname is null, '(empty)', first_hostname) as string_value
          ) as value
        ),
        struct( 
          'first_page_path' as key,
          struct(
            if(first_page_path is null, '(empty)', concat('/', first_page_path)) as string_value
          ) as value
        ),
        struct( 
          'first_hostname_path' as key,
          struct(
            if(concat(first_hostname, '/', first_page_path) is null, '(empty)', concat(first_hostname, '/', first_page_path)) as string_value
          ) as value
        ),
        struct( 
          'last_hostname' as key,
          struct(
            if(last_hostname is null, '(empty)', last_hostname) as string_value
          ) as value
        ),
        struct( 
          'last_page_path' as key,
          struct(
            if(last_page_path is null, '(empty)', concat('/', last_page_path)) as string_value
          ) as value
        ),
        struct( 
          'last_hostname_path' as key,
          struct(
            if(concat(last_hostname, '/', last_page_path) is null, '(empty)', concat(last_hostname, '/', last_page_path)) as string_value
          ) as value
        )
      ]
    ) as url_params,
    first_hostname,
    first_page_path,
    first_page_url,
    last_hostname,
    last_page_path,
    last_page_url
  from browser_events_with_last_page_info
  where visit_id is not null
)

select * from visits_table)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);
set query = replace(query, '<project_timezone>', _project_timezone);

execute immediate (query);

end;

--------------------------------------------------------------------------
--------------------- 5. SATURATE EVENTS WITH VISITS ---------------------
--------------------------------------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
-- Saturate all browser events by visit_id
create temp table `identified_events_with_visits` as (
with marked_first_visit_events as (
  select
    e.timestamp,
    v.visit_id,
    e.event_id,
    e.event_name,
    e.event_params,
    e.user_data,
    e.user_properties,
    e.user_external_ids,
    e.profile_id,
    e.strimix_avid,
    e.ad_data,
    e.deal,
    e.offers,
    e.order,
    e.products,
    e.transaction,
    e.geo,
    e.device_info,
    e.is_test_event,
  from `identified_events` as e
  left join `<project_name>.<dataset_name>.visits` v
  on e.event_id = v.first_event_id
)

select
  timestamp,
  case 
    when device_info.web_info.user_agent is not null
    then last_value(visit_id ignore nulls) over(partition by profile_id order by timestamp asc rows between unbounded preceding and current row) 
    else null end as visit_id,
  event_id,
  event_name,
  event_params,
  user_data,
  user_properties,
  user_external_ids,
  profile_id,
  strimix_avid,
  ad_data,
  deal,
  offers,
  `order`,
  products,
  transaction,
  geo,
  device_info,
  is_test_event
from marked_first_visit_events)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

end;

--------------------------------------------------------------------------
--------------------- 6. SATURATE EVENTS WITH VISITS ---------------------
--------------------------------------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create or replace table `<project_name>.<dataset_name>.attributed_events`
partition by date options (require_partition_filter = false) as (
-- Prepare all events table: join attr visits classification
with all_events as (
  select
    e.timestamp,
    e.visit_id,
    v.non_direct_visit_id,
    v.marked_visit_id,
    e.event_id,
    e.event_name,
    e.event_params,
    e.user_data,
    e.user_properties,
    e.user_external_ids,
    e.profile_id,
    e.strimix_avid,
    e.ad_data,
    e.deal,
    e.offers,
    e.order,
    e.products,
    e.transaction,
    e.geo,
    e.device_info,
    e.is_test_event
  from `identified_events_with_visits` as e
  left join `<project_name>.<dataset_name>.visits` as v
  on e.event_id = v.first_event_id
), 

-- Calculate last click and first click attr visits and page_views for each event
all_events_attributed_by_first_and_last_click as (
    select
        timestamp,
        event_id,
        event_name,
        event_params,
        user_data,
        user_properties,
        user_external_ids,
        profile_id,
        strimix_avid,
        ad_data,  
        deal,
        offers,
        `order`,
        products,
        transaction,
        geo,
        device_info,
        visit_id,
        first_value(visit_id ignore nulls) 
            over (partition by profile_id order by timestamp asc rows between unbounded preceding and current row)
        as first_attr_visit,
        last_value(visit_id ignore nulls) 
            over (partition by profile_id order by timestamp asc rows between unbounded preceding and current row)
        as last_attr_visit,
        last_value(non_direct_visit_id ignore nulls) 
            over (partition by profile_id order by timestamp asc rows between unbounded preceding and current row)
        as last_non_direct_attr_visit,
        last_value(marked_visit_id ignore nulls) 
            over (partition by profile_id order by timestamp asc rows between unbounded preceding and current row)
        as last_marked_attr_visit,
        null as linear_attr_visits,
        is_test_event
    from all_events
),

----------------------------------------
-- Calculate visits linear attr rates --
----------------------------------------

-- Prepare indirect attr visits
indirect_visits as (
  select
    t1.timestamp,
    t1.profile_id,
    t1.visit_id
  from `<project_name>.<dataset_name>.visits` as t1
  where source not like '(direct)'
),

-- Prepare direct attr visits
direct_visits as (
  select
    t1.timestamp,
    t1.profile_id,
    t1.visit_id
  from `<project_name>.<dataset_name>.visits` as t1
  where
    t1.source like '(direct)'
    -- Exclude profiles who has indirect visits before
    and (
      select count(t2.visit_id) 
      from `<project_name>.<dataset_name>.visits` as t2
      where
        t2.profile_id = t1.profile_id
        and t2.source not like '(direct)'
        and t2.timestamp < t1.timestamp
    ) = 0
),

-- Merge attr visits
visits_log as (
  select * from indirect_visits
  union all select * from direct_visits
),

-- Attach attr visits to each event
visits_lin_attr_events as (
  select
    t1.timestamp,
    t1.profile_id,
    t1.event_id,
    t1.event_name,
    array_agg(struct(t2.timestamp as timestamp, t2.visit_id as visit_id) ignore nulls order by t2.timestamp asc) as lin_attr_visits
  from all_events as t1
  left join visits_log as t2
  on t1.profile_id = t2.profile_id
  and t2.timestamp <= t1.timestamp
  group by t1.timestamp, t1.profile_id, t1.event_id, t1.event_name
  order by t1.timestamp asc
),

-- Calculate lin attr rate for each attr page_view
visits_lin_attr_rates as (
  select
    timestamp,
    profile_id,
    event_id,
    event_name,
    array(
      select as struct 
        p.timestamp, 
        p.visit_id,
        round((1 / count(distinct p.visit_id) over()), 3) as lin_attr_rate
      from unnest(lin_attr_visits) as p
      where p.visit_id is not null
      order by timestamp asc
    ) as visits_lin_attr_rates
  from visits_lin_attr_events
)

-- Merge lin_attr_rates with all_events
select
  extract(date from timestamp_millis(t1.timestamp) at time zone <project_timezone>) date,
  t1.timestamp,
  t1.visit_id,
  t1.event_id,
  t1.event_name,
  t1.event_params,
  t1.user_data,
  t1.user_properties,
  t1.user_external_ids,
  t1.profile_id,
  t1.strimix_avid,
  t1.ad_data,
  t1.deal,
  t1.offers,
  t1.order,
  t1.products,
  t1.transaction,
  t1.geo,
  t1.device_info,
  t1.first_attr_visit,
  t1.last_attr_visit,
  ifnull(t1.last_non_direct_attr_visit, t1.last_attr_visit) last_non_direct_attr_visit,
  ifnull(t1.last_marked_attr_visit, ifnull(t1.last_non_direct_attr_visit, t1.last_attr_visit)) last_marked_attr_visit,
  t3.visits_lin_attr_rates as linear_attr_visits,
  t1.is_test_event
from all_events_attributed_by_first_and_last_click as t1
left join visits_lin_attr_rates as t3
on t1.event_id = t3.event_id)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);
set query = replace(query, '<project_timezone>', _project_timezone);

execute immediate (query);

end;

-------------------------------------------
--------- 7. Create orders table ----------
-------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create or replace table `<project_name>.<dataset_name>.orders`
partition by date options (require_partition_filter = false) as(
with all_orders_events as (
  select
    timestamp,
    event_id,
    profile_id,
    `order`,
    products,
    -- Attribute order source by first order event
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), first_attr_visit, null) first_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), last_attr_visit, null) last_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), last_non_direct_attr_visit, null) last_non_direct_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), last_marked_attr_visit, null) last_marked_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), linear_attr_visits, null) linear_attr_visits,
    if(timestamp = min(timestamp) over (partition by profile_id, `order`.id order by timestamp asc rows between unbounded preceding and unbounded following), event_id, null) attribution_event_id,
    last_value(event_id) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) last_event_id
  from `<project_name>.<dataset_name>.attributed_events` where `order`.id is not null
), 

orders_last_info_ungroupped as (
  select
    `order`.id as id,
    last_value(profile_id) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) _profile_id,
    last_value(`order`.status) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as status,
    last_value(`order`.manager) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as manager,
    last_value(`order`.value) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as value,
    last_value(`order`.paid_value) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as paid_value,
    last_value(`order`.refund_value) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as refund_value,
    last_value(`order`.currency) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as currency,
    last_value(`order`.shipping) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as shipping,
    last_value(`order`.tax) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as tax,
    last_value(`order`.promo_action) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as promo_action,
    last_value(`order`.discount_amount) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as discount_amount,
    last_value(`order`.discount_percentage) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as discount_percentage,
    last_value(`order`.payment_method) over(partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) as payment_method,
    min(timestamp) over (partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) creation_timestamp,
    max(timestamp) over (partition by `order`.id order by timestamp asc rows between unbounded preceding and unbounded following) last_update_timestamp
  from all_orders_events
  group by 
    event_id, 
    id, 
    profile_id, 
    `order`.status, 
    `order`.manager, 
    `order`.value, 
    `order`.paid_value, 
    `order`.refund_value,
    `order`.currency, 
    `order`.shipping,
    `order`.tax,
    `order`.promo_action, 
    `order`.discount_amount, 
    `order`.discount_percentage, 
    `order`.payment_method, 
    timestamp
),

orders_last_info_groupped as (
  select
    id,
    _profile_id profile_id, 
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    shipping,
    tax,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp
  from orders_last_info_ungroupped
  group by 
    id,
    profile_id, 
    status, 
    manager, 
    value, 
    paid_value,
    refund_value, 
    currency, 
    shipping,
    tax,
    promo_action, 
    discount_amount, 
    discount_percentage, 
    payment_method, 
    creation_timestamp,
    last_update_timestamp
),

orders_last_info_with_single_attribution_ungroupped as (
  select
    t1.id,
    t1.profile_id, 
    last_value(t2.first_attr_visit ignore nulls) over(partition by t2.order.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as first_attr_visit,
    last_value(t2.last_attr_visit ignore nulls) over(partition by t2.order.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_attr_visit,
    last_value(t2.last_non_direct_attr_visit ignore nulls) over(partition by t2.order.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_non_direct_attr_visit,
    last_value(t2.last_marked_attr_visit ignore nulls) over(partition by t2.order.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_marked_attr_visit,
    t1.status,
    t1.manager,
    t1.value,
    t1.paid_value,
    t1.refund_value,
    t1.currency,
    t1.shipping,
    t1.tax,
    t1.promo_action,
    t1.discount_amount,
    t1.discount_percentage,
    t1.payment_method,
    t1.creation_timestamp,
    t1.last_update_timestamp,
    t2.last_event_id,
    last_value(t2.attribution_event_id ignore nulls) over(partition by t2.order.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as attribution_event_id,
  from orders_last_info_groupped t1
  left join all_orders_events t2
  on t1.id = t2.order.id
),

orders_last_info_with_single_attribution_groupped as (
  select
    id,
    profile_id, 
    first_attr_visit,
    last_attr_visit,
    last_non_direct_attr_visit,
    last_marked_attr_visit,
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    shipping,
    tax,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp,
    attribution_event_id,
    last_event_id
  from orders_last_info_with_single_attribution_ungroupped
  group by
    id,
    profile_id, 
    first_attr_visit,
    last_attr_visit,
    last_non_direct_attr_visit,
    last_marked_attr_visit,
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    shipping,
    tax,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp,
    attribution_event_id,
    last_event_id
),

orders_result as (
  select
    extract(date from timestamp_millis(t1.creation_timestamp) at time zone "Europe/Kiev") date,
    t1.id,
    t1.profile_id,
    case when
        -- If this is the first order
        first_value(t1.id) over(partition by t1.profile_id order by t1.creation_timestamp asc rows between unbounded preceding and current row) = t1.id
        then true
        else false end is_first_order,
    case when
        -- If this is the first order
        (first_value(t1.id) over(partition by t1.profile_id order by t1.creation_timestamp asc rows between unbounded preceding and current row) = t1.id
        -- Or not the first but before weren't paid orders
        or (select count(distinct t3.id) from orders_last_info_with_single_attribution_groupped t3 where t3.profile_id = t1.profile_id and t3.paid_value > 0 and t3.creation_timestamp < t1.creation_timestamp) = 0)
        and t1.paid_value > 0
        then true
        else false end is_first_paid_order,
    t1.first_attr_visit, 
    t1.last_attr_visit, 
    t1.last_non_direct_attr_visit, 
    t1.last_marked_attr_visit,
    t2.linear_attr_visits,
    t1.status,
    t1.manager,
    t1.value,
    t1.paid_value,
    t1.refund_value,
    t1.currency,
    t1.shipping,
    t1.tax,
    t1.promo_action,
    t1.discount_amount,
    t1.discount_percentage,
    t1.payment_method,
    (select it.products from all_orders_events it where it.event_id = t1.last_event_id) products,
    (select it.`order`.custom_params from all_orders_events it where it.event_id = t1.last_event_id) custom_params,
    t1.creation_timestamp,
    t1.last_update_timestamp,
  from orders_last_info_with_single_attribution_groupped as t1
  left join all_orders_events as t2
  on t1.attribution_event_id = t2.event_id
)

select
  t1.date,
  t1.id,
  t1.profile_id,
  t1.is_first_order,
  t1.is_first_paid_order,
  t1.first_attr_visit,
  t1.last_attr_visit,
  t1.last_non_direct_attr_visit,
  t1.last_marked_attr_visit,
  t1.linear_attr_visits,
  t1.status,
  t1.manager,
  t1.value,
  t1.paid_value,
  t1.refund_value,
  t1.currency,
  t1.shipping,
  t1.tax,
  t1.promo_action,
  t1.discount_amount,
  t1.discount_percentage,
  t1.payment_method,
  t1.products,
  array_concat(
    custom_params,
    [
      struct( 
        'order_source' as key,
        struct(
          if(t2.visit_id is null, '(not found)', t2.source) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      ),
      struct( 
        'order_medium' as key,
        struct(
          if(t2.visit_id is null, '(not found)', t2.medium) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      ),
      struct( 
        'order_campaign' as key,
        struct(
          if(t2.visit_id is null, '(not found)', t2.campaign) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      ),
      struct( 
        'order_content' as key,
        struct(
          if(t2.visit_id is null, '(not found)', t2.content) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      ),
      struct( 
        'order_term' as key,
        struct(
          if(t2.visit_id is null, '(not found)', t2.term) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      ),
      struct( 
        'order_fbclid' as key,
        struct(
          if((select vp.value.string_value from unnest(t2.url_params) vp where vp.key = 'fbclid') is null, '(not found)', (select vp.value.string_value from unnest(t2.url_params) vp where vp.key = 'fbclid')) as string_value,
          cast(null as int64) as int_value,
          cast(null as float64) as  double_value,
          cast(null as bool) as boolean_value
        ) as value
      )
    ]
  ) as custom_params,
  t1.creation_timestamp,
  t1.last_update_timestamp
from orders_result t1
left join `<project_name>.<dataset_name>.visits` t2
on t1.last_marked_attr_visit = t2.visit_id
)
""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);
set query = replace(query, '<project_timezone>', _project_timezone);

execute immediate (query);

end;

------------------------------------------
--------- 8. Create deals table ----------
------------------------------------------

begin

declare query string;
declare query_template string;

set query_template = """
create or replace table `<project_name>.<dataset_name>.deals`
partition by date options (require_partition_filter = false) as(
with all_deals_events as (
  select
    timestamp,
    event_id,
    deal,
    profile_id,
    -- Attribute deal source by first deal event
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), first_attr_visit, null) first_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), last_attr_visit, null) last_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), last_non_direct_attr_visit, null) last_non_direct_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), last_marked_attr_visit, null) last_marked_attr_visit,
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), linear_attr_visits, null) linear_attr_visits,
    if(timestamp = min(timestamp) over (partition by profile_id, deal.id order by timestamp asc rows between unbounded preceding and unbounded following), event_id, null) attribution_event_id,
    last_value(event_id) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) last_event_id
  from `<project_name>.<dataset_name>.attributed_events` where deal.id is not null
), 

deals_last_info_ungroupped as (
  select
    deal.id as id,
    last_value(profile_id) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) _profile_id,
    last_value(deal.status) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as status,
    last_value(deal.manager) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as manager,
    last_value(deal.value) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as value,
    last_value(deal.paid_value) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as paid_value,
    last_value(deal.refund_value) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as refund_value,
    last_value(deal.currency) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as currency,
    last_value(deal.promo_action) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as promo_action,
    last_value(deal.discount_amount) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as discount_amount,
    last_value(deal.discount_percentage) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as discount_percentage,
    last_value(deal.payment_method) over(partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) as payment_method,
    min(timestamp) over (partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) creation_timestamp,
    max(timestamp) over (partition by deal.id order by timestamp asc rows between unbounded preceding and unbounded following) last_update_timestamp
  from all_deals_events
  group by 
    event_id, 
    id, 
    profile_id, 
    deal.status, 
    deal.manager, 
    deal.value, 
    deal.paid_value, 
    deal.refund_value,
    deal.currency, 
    deal.promo_action, 
    deal.discount_amount, 
    deal.discount_percentage, 
    deal.payment_method,
    timestamp
),

deals_last_info_groupped as (
  select
    id,
    _profile_id profile_id, 
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp
  from deals_last_info_ungroupped
  group by 
    id,
    profile_id, 
    status, 
    manager, 
    value, 
    paid_value, 
    refund_value,
    currency, 
    promo_action, 
    discount_amount, 
    discount_percentage, 
    payment_method, 
    creation_timestamp,
    last_update_timestamp
),

deals_last_info_with_single_attribution_ungroupped as (
  select
    t1.id,
    t1.profile_id, 
    last_value(t2.first_attr_visit ignore nulls) over(partition by t2.deal.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as first_attr_visit,
    last_value(t2.last_attr_visit ignore nulls) over(partition by t2.deal.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_attr_visit,
    last_value(t2.last_non_direct_attr_visit ignore nulls) over(partition by t2.deal.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_non_direct_attr_visit,
    last_value(t2.last_marked_attr_visit ignore nulls) over(partition by t2.deal.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as last_marked_attr_visit,
    t1.status,
    t1.manager,
    t1.value,
    t1.paid_value,
    t1.refund_value,
    t1.currency,
    t1.promo_action,
    t1.discount_amount,
    t1.discount_percentage,
    t1.payment_method,
    t1.creation_timestamp,
    t1.last_update_timestamp,
    t2.last_event_id,
    last_value(t2.attribution_event_id ignore nulls) over(partition by t2.deal.id order by t2.timestamp asc rows between unbounded preceding and unbounded following) as attribution_event_id,
  from deals_last_info_groupped t1
  left join all_deals_events t2
  on t1.id = t2.deal.id
),

deals_last_info_with_single_attribution_groupped as (
  select
    id,
    profile_id, 
    first_attr_visit,
    last_attr_visit,
    last_non_direct_attr_visit,
    last_marked_attr_visit,
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp,
    attribution_event_id,
    last_event_id
  from deals_last_info_with_single_attribution_ungroupped
  group by
    id,
    profile_id, 
    first_attr_visit,
    last_attr_visit,
    last_non_direct_attr_visit,
    last_marked_attr_visit,
    status,
    manager,
    value,
    paid_value,
    refund_value,
    currency,
    promo_action,
    discount_amount,
    discount_percentage,
    payment_method,
    creation_timestamp,
    last_update_timestamp,
    attribution_event_id,
    last_event_id
)

select
  extract(date from timestamp_millis(t1.creation_timestamp) at time zone <project_timezone>) date,
  t1.id,
  t1.profile_id,
  t1.first_attr_visit, 
  t1.last_attr_visit, 
  t1.last_non_direct_attr_visit, 
  t1.last_marked_attr_visit,
  t2.linear_attr_visits,
  t1.status,
  t1.manager,
  t1.value,
  t1.paid_value,
  t1.refund_value,
  t1.currency,
  t1.promo_action,
  t1.discount_amount,
  t1.discount_percentage,
  t1.payment_method,
  (select it.deal.custom_params from all_deals_events it where it.event_id = t1.last_event_id) custom_params,
  t1.creation_timestamp,
  t1.last_update_timestamp,
from deals_last_info_with_single_attribution_groupped as t1
left join all_deals_events as t2
on t1.attribution_event_id = t2.event_id)""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);
set query = replace(query, '<project_timezone>', _project_timezone);

execute immediate (query);

end;

end;