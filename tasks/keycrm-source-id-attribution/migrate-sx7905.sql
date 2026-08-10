-- KeyCRM source_id attribution — sx_7905 (Instagram Direct via Meta chat, source_id = 16)
--
-- Task folder: tasks/keycrm-source-id-attribution/
-- Docs:        tasks/keycrm-source-id-attribution/README.md
--
-- =============================================================================
-- Design (attributed_ad name tiers, data schema v2)
-- =============================================================================
--
-- Проблема тёзок: имена объявлений массово дублируются между группами и
-- кампаниями (таргетолог копирует креатив). Резолюция по ad_name находит
-- несколько строк ad_costs → однозначные id в attributed_ad не записываются
-- → id-ярусы 2–4 отчёта не срабатывают.
--
-- Решение — на уровне движка, не конфига: attributed_ad теперь хранит и
-- ОДНОЗНАЧНЫЕ НАЗВАНИЯ (campaign_name / adgroup_name / ad_name) плюс
-- ad_destination. Отчёт (data schema v2) склеивает визит с расходами
-- каскадом:
--
--   ярусы 2–4  id (ad → adgroup → campaign)
--   ярусы 5–7  названия (ad_name → adgroup_name → campaign_name),
--              замки строгого равенства: data_source + ad_destination
--   ярус 8     полная UTM-связка
--
-- Для тёзок работает ярус 5: все кост-строки «Промо март» (facebook_ads +
-- chat) схлопываются в один бакет, визит склеивается с ним один раз,
-- кампания/группа в ячейках отчёта получают '(combined)' при чтении.
--
-- Чтобы замки ярусов были однозначными, mapping задаёт ОБЕ границы
-- резолюции: ad_destination_regex='^chat$' (одноимённое сайтовое объявление
-- не кандидат) и data_source_regex='(?i)^facebook_ads$' (кросс-сетевая тёзка
-- не размывает data_source).
--
-- Метки визита — два правила перевода стадии utm (оба target=visit; на
-- строках расходов source=16 не существует, там работают свои правила).
-- Проекция меток и refid-константы НЕ нужны: склейка с расходами идёт
-- через attributed_ad, а не через метки.
--
--   950  зарезолвленная реклама (гейт chat + facebook_ads) → instagram/paid
--   960  фолбэк-органика: сигнал без зарезолвленной рекламы (коммент
--        «профіль», ссылка на CRM-карточку и т.п.) → instagram/organic.
--        На зарезолвленных визитах совпадают оба правила, но каждое поле
--        выигрывает правило с меньшим priority — рекламное (950).
--   990  ad_cost: канонический source из {data_source} → 'facebook_ads'
--        (lowercase поверх sys_utm_projection_ad_costs, который пишет
--        FACEBOOK_ADS как есть из колонки data_source).
--
-- Origin / channel:
--   sys_origin_meta_ads (seed)       → instagram + paid → 'Meta Ads'
--   custom_origin_instagram_organic  → instagram + organic → 'Instagram'
--   sys_channel_paid_social (seed)   → 'Meta Ads' → 'Paid Social'
--   sys_channel_organic_social_origin (seed) → 'Instagram' → 'Organic Social'
--
-- Idempotency: каждый прогон — DELETE всех id этого файла, затем INSERT.
-- Правки в structs ниже подхватываются без ручной чистки в BigQuery.
--
-- Prerequisites:
--   1. Джоба с расширенным attributed_ad задеплоена и прогнана
--      (visits пересоздаётся с новым struct автоматически).
--   2. Проект переведён на data schema v2 (включает ярусы attributed_ad).
--
-- Before running:
--   1. Run in BigQuery console (project/dataset already set: strimix-clients / sx_7905).
--   2. Re-run the unified attribution job.

-- =============================================================================
-- 0. Cleanup — все id этого файла + старые драфты (перед INSERT)
-- =============================================================================

delete from `strimix-clients.sx_7905.traffic_rules`
where rule_id in (
  -- rules of this file (перезапись при каждом прогоне)
  'custom_keycrm_utm_16_instagram_chat',
  'custom_keycrm_utm_16_instagram_organic',
  'custom_origin_instagram_organic',
  'custom_utm_facebook_ads_source_lowercase',
  -- «twins-proof» draft (refid-константа + пара правил проекции): отменён,
  -- склейку тёзок делают имён-ярусы attributed_ad
  'custom_keycrm_utm_16_chat_visit',
  'custom_keycrm_utm_fb_chat_ad_cost',
  -- older drafts
  'custom_keycrm_origin_16_instagram_direct',
  'custom_keycrm_channel_instagram_direct',
  'custom_keycrm_utm_instagram_chat',
  'custom_keycrm_origin_instagram_direct'
);

delete from `strimix-clients.sx_7905.attribution_signal_mappings`
where mapping_id in (
  'custom_keycrm_instagram_chat',
  'custom_keycrm_16_instagram_chat'
);

-- =============================================================================
-- 1. Mapping — source_id 16 → source, resolve by manager comment (fb + chat)
-- =============================================================================

insert into `strimix-clients.sx_7905.attribution_signal_mappings`
(
  mapping_id,
  priority,
  is_active,
  entity,
  param_source,
  source_param_key,
  medium_param_key,
  campaign_param_key,
  content_param_key,
  term_param_key,
  strimix_refid_param_key,
  campaign_id_param_key,
  campaign_name_param_key,
  adgroup_id_param_key,
  adgroup_name_param_key,
  ad_id_param_key,
  ad_name_param_key,
  match_source_regex,
  match_medium_regex,
  match_campaign_regex,
  match_content_regex,
  match_term_regex,
  match_strimix_refid_regex,
  match_campaign_id_regex,
  match_campaign_name_regex,
  match_adgroup_id_regex,
  match_adgroup_name_regex,
  match_ad_id_regex,
  match_ad_name_regex,
  ad_destination_regex,
  data_source_regex,
  event_name,
  mode
)
select
  s.mapping_id,
  s.priority,
  s.is_active,
  s.entity,
  s.param_source,
  s.source_param_key,
  s.medium_param_key,
  s.campaign_param_key,
  s.content_param_key,
  s.term_param_key,
  s.strimix_refid_param_key,
  s.campaign_id_param_key,
  s.campaign_name_param_key,
  s.adgroup_id_param_key,
  s.adgroup_name_param_key,
  s.ad_id_param_key,
  s.ad_name_param_key,
  s.match_source_regex,
  s.match_medium_regex,
  s.match_campaign_regex,
  s.match_content_regex,
  s.match_term_regex,
  s.match_strimix_refid_regex,
  s.match_campaign_id_regex,
  s.match_campaign_name_regex,
  s.match_adgroup_id_regex,
  s.match_adgroup_name_regex,
  s.match_ad_id_regex,
  s.match_ad_name_regex,
  s.ad_destination_regex,
  s.data_source_regex,
  s.event_name,
  s.mode
from unnest([
  struct(
    'custom_keycrm_16_instagram_chat' as mapping_id,
    100 as priority,
    true as is_active,
    'order' as entity,
    'custom_params' as param_source,
    -- Сырой CRM-код в source: правило перевода ниже превратит его в
    -- instagram/paid. Склейка с расходами через attributed_ad, поэтому
    -- проекция меток не нужна и блокировка all-or-nothing не мешает.
    'keycrm_source_id' as source_param_key,
    cast(null as string) as medium_param_key,
    cast(null as string) as campaign_param_key,
    cast(null as string) as content_param_key,
    cast(null as string) as term_param_key,
    cast(null as string) as strimix_refid_param_key,
    cast(null as string) as campaign_id_param_key,
    cast(null as string) as campaign_name_param_key,
    cast(null as string) as adgroup_id_param_key,
    cast(null as string) as adgroup_name_param_key,
    cast(null as string) as ad_id_param_key,
    'keycrm_manager_comment' as ad_name_param_key,
    -- Роутер потоков: этот mapping обслуживает только source_id=16.
    '^16$' as match_source_regex,
    cast(null as string) as match_medium_regex,
    cast(null as string) as match_campaign_regex,
    cast(null as string) as match_content_regex,
    cast(null as string) as match_term_regex,
    cast(null as string) as match_strimix_refid_regex,
    cast(null as string) as match_campaign_id_regex,
    cast(null as string) as match_campaign_name_regex,
    cast(null as string) as match_adgroup_id_regex,
    cast(null as string) as match_adgroup_name_regex,
    cast(null as string) as match_ad_id_regex,
    '.+' as match_ad_name_regex,
    -- Границы резолюции: только chat-строки facebook_ads. Обе границы
    -- обязательны — они делают data_source и ad_destination в attributed_ad
    -- однозначными (замки имён-ярусов 5–7 в отчёте).
    '^chat$' as ad_destination_regex,
    '(?i)^facebook_ads$' as data_source_regex,
    cast(null as string) as event_name,
    'override' as mode
  )
]) as s;

-- =============================================================================
-- 2. Traffic rules — utm / origin для source_id=16 + lowercase facebook_ads
-- =============================================================================

insert into `strimix-clients.sx_7905.traffic_rules`
(
  rule_id,
  priority,
  is_active,
  is_system,
  stage,
  target,
  applies_to_web,
  source_regex,
  medium_regex,
  campaign_regex,
  content_regex,
  term_regex,
  strimix_refid_regex,
  ad_destination_regex,
  data_source_regex,
  traffic_origin_regex,
  set_source,
  set_medium,
  set_campaign,
  set_content,
  set_term,
  set_strimix_refid,
  set_traffic_origin,
  set_traffic_channel
)
select
  s.rule_id,
  s.priority,
  s.is_active,
  s.is_system,
  s.stage,
  s.target,
  s.applies_to_web,
  s.source_regex,
  s.medium_regex,
  s.campaign_regex,
  s.content_regex,
  s.term_regex,
  s.strimix_refid_regex,
  s.ad_destination_regex,
  s.data_source_regex,
  s.traffic_origin_regex,
  s.set_source,
  s.set_medium,
  s.set_campaign,
  s.set_content,
  s.set_term,
  s.set_strimix_refid,
  s.set_traffic_origin,
  s.set_traffic_channel
from unnest([
  -- Гейт: source='16' + резолюция подтвердила facebook_ads + chat (ad-условия
  -- проверяются по visit_ad_groups; на web-визитах не матчатся никогда).
  -- target=visit: на строках расходов source=16 не существует. Без группы
  -- правило не срабатывает — фолбэк 960 пишет instagram/organic.
  struct(
    'custom_keycrm_utm_16_instagram_chat' as rule_id,
    950 as priority,
    true as is_active,
    false as is_system,
    'utm' as stage,
    'visit' as target,
    false as applies_to_web,
    '^16$' as source_regex,
    cast(null as string) as medium_regex,
    cast(null as string) as campaign_regex,
    cast(null as string) as content_regex,
    cast(null as string) as term_regex,
    cast(null as string) as strimix_refid_regex,
    '^chat$' as ad_destination_regex,
    '(?i)^facebook_ads$' as data_source_regex,
    cast(null as string) as traffic_origin_regex,
    'instagram' as set_source,
    'paid' as set_medium,
    cast(null as string) as set_campaign,
    cast(null as string) as set_content,
    cast(null as string) as set_term,
    cast(null as string) as set_strimix_refid,
    cast(null as string) as set_traffic_origin,
    cast(null as string) as set_traffic_channel
  ),

  -- Фолбэк-органика: сигнал source='16' без зарезолвленной рекламы (коммент
  -- «профіль», ссылка на карточку клиента и т.п.) — лид из Instagram Direct
  -- без рекламного следа. Правило без рекламных условий, поэтому совпадает
  -- со ВСЕМИ синтетиками source='16', но на зарезолвленных каждое поле
  -- выигрывает правило 950 (priority меньше) — сюда падает только органика.
  struct(
    'custom_keycrm_utm_16_instagram_organic' as rule_id,
    960 as priority,
    true as is_active,
    false as is_system,
    'utm' as stage,
    'visit' as target,
    false as applies_to_web,
    '^16$' as source_regex,
    cast(null as string) as medium_regex,
    cast(null as string) as campaign_regex,
    cast(null as string) as content_regex,
    cast(null as string) as term_regex,
    cast(null as string) as strimix_refid_regex,
    cast(null as string) as ad_destination_regex,
    cast(null as string) as data_source_regex,
    cast(null as string) as traffic_origin_regex,
    'instagram' as set_source,
    'organic' as set_medium,
    cast(null as string) as set_campaign,
    cast(null as string) as set_content,
    cast(null as string) as set_term,
    cast(null as string) as set_strimix_refid,
    cast(null as string) as set_traffic_origin,
    cast(null as string) as set_traffic_channel
  ),

  -- Канонический source на строках расходов: системная проекция пишет
  -- set_source='{data_source}' → 'FACEBOOK_ADS' (как в колонке). Это правило
  -- выигрывает только поле source (priority 990 < 1000); medium/campaign/
  -- content/term остаются у sys_utm_projection_ad_costs.
  struct(
    'custom_utm_facebook_ads_source_lowercase' as rule_id,
    990 as priority,
    true as is_active,
    false as is_system,
    'utm' as stage,
    'ad_cost' as target,
    false as applies_to_web,
    cast(null as string) as source_regex,
    cast(null as string) as medium_regex,
    cast(null as string) as campaign_regex,
    cast(null as string) as content_regex,
    cast(null as string) as term_regex,
    cast(null as string) as strimix_refid_regex,
    cast(null as string) as ad_destination_regex,
    '(?i)^facebook_ads$' as data_source_regex,
    cast(null as string) as traffic_origin_regex,
    'facebook_ads' as set_source,
    cast(null as string) as set_medium,
    cast(null as string) as set_campaign,
    cast(null as string) as set_content,
    cast(null as string) as set_term,
    cast(null as string) as set_strimix_refid,
    cast(null as string) as set_traffic_origin,
    cast(null as string) as set_traffic_channel
  ),

  -- Origin для инстаграм-органики: instagram + organic → 'Instagram'.
  -- Канал дальше подтянет системный seed sys_channel_organic_social_origin
  -- ('Instagram' → 'Organic Social'), отдельное channel-правило не нужно.
  -- Priority 1260 — после sys_origin_meta_ads (1020): платный instagram
  -- трафик остаётся 'Meta Ads'.
  struct(
    'custom_origin_instagram_organic' as rule_id,
    1260 as priority,
    true as is_active,
    false as is_system,
    'origin' as stage,
    'visit' as target,
    false as applies_to_web,
    '(?i)^instagram$' as source_regex,
    '(?i)^organic$' as medium_regex,
    cast(null as string) as campaign_regex,
    cast(null as string) as content_regex,
    cast(null as string) as term_regex,
    cast(null as string) as strimix_refid_regex,
    cast(null as string) as ad_destination_regex,
    cast(null as string) as data_source_regex,
    cast(null as string) as traffic_origin_regex,
    cast(null as string) as set_source,
    cast(null as string) as set_medium,
    cast(null as string) as set_campaign,
    cast(null as string) as set_content,
    cast(null as string) as set_term,
    cast(null as string) as set_strimix_refid,
    'Instagram' as set_traffic_origin,
    cast(null as string) as set_traffic_channel
  )
]) as s;
