# ТЗ: UTM Naming Convention v2 + дефолтные Traffic Rules

**Версия:** 0.1 (draft для реализации)  
**Дата:** 2026-08-09  
**Статус:** проектирование — код не менять до утверждения  
**Связанные документы:**

- `docs/traffic-classification-and-synthetic-attribution.md` — архитектура джобы и traffic_rules (§3.1.1 — пошаговая инструкция по mapping)
- `docs/attribution-signal-mappings-instruction.md` — практическая инструкция: сценарии, схема, `source_id` + `ad_name`
- `docs/utm-naming-convention-v2-open-questions.md` — открытые решения (отдельный файл)
- Источник v1: `Strimix.io - UTM generator.xlsx` (Desktop)

**Зависимости:** attribution job (`update-costs-and-calculate-attribution.sql`), таблица `traffic_rules`, таблица `attribution_signal_mappings`, reporting-service v2 (каскад матчинга по UTM / `attributed_ad` / `strimix_refid`).

---

## 1. Зачем это нужно

### 1.1. Проблема

1. **Google Ads в отчётах.** Сейчас все строки с `traffic_origin = Google Ads` попадают в `traffic_channel = Paid Search` через правило `sys_channel_paid_search`, хотя в рекламном аккаунте одновременно могут работать Search, YouTube, Performance Max, Demand Gen, Shopping, GDN и другие типы кампаний.

2. **Старый UTM generator (Excel).** В поле `utm_medium` для разных рекламных сетей закодированы **разные смыслы**:
   - **Google** → тип размещения / inventory (`paid_search`, `youtube`, `performance_max`, …)
   - **Meta / Facebook Ads** → цель / тип оптимизации кампании (`conversions`, `traffic`, `leads`, …)
   - **TikTok Ads** → то же, что Meta (`conversions`, `traffic`, `reach`, …)
   - **Email / SMS / Telegram** → тип коммуникации (`broadcast`, `funnel`, …)

3. **Разрыв с движком Strimix.** Отчёт по рекламе (`ad_channels_table`) матчит визиты и расходы по **каноническим UTM** (source, medium, campaign, content, term) и по `attributed_ad` / `strimix_refid`. Поля `traffic_origin` и `traffic_channel` используются для **группировки**, но **не являются ключом join**. Чтобы и классификация в дашбордах, и матчинг visits↔costs работали предсказуемо, UTM на визитах и на строках расходов должны быть **согласованы**, **однозначны** и следовать **единой семантике полей**.

### 1.2. Цель v2

1. Зафиксировать **единую семантику** полей UTM для всех каналов: что означает source, medium, campaign, content, term, strimix_refid.
2. `utm_source` = **рекламная платформа или owned-канал** (один словарь, canonical lowercase snake_case).
3. `utm_medium` = для paid media — **тип размещения / inventory / surface**; для owned/organic — **подтип касания** (bio, broadcast, qr, smm, …).
4. Автоматически получать **`traffic_origin`** (платформа) и **`traffic_channel`** (отчётный канал) через дефолтные `traffic_rules`, в том числе с условиями **`source + medium`** и `target = both` там, где нужна симметрия visits↔costs.
5. Обновить UTM generator (продукт) и подготовить migration guide для существующих проектов.

---

## 2. Инвентаризация текущего Excel (UTM generator v1)

### 2.1. Листы файла

| Лист | Содержание |
|------|------------|
| **Settings** | Справочник «Traffic type → utm_source, utm_medium, strimix_refid» (~50 строк) |
| **Links** | Примеры финальных URL (подмножество Settings, ~12 строк) |
| **Dynamic URL Params Spec** | Динамические параметры Meta, Google, TikTok |

### 2.2. Что в Excel сделано хорошо

1. **Google уже близок к целевой модели v2:**  
   `utm_source=google_ads`, `utm_medium` ∈ {`paid_search`, `youtube`, `demand_gen`, `performance_max`, `gdn`, `discovery`, `shopping`, `smart`}.

2. **Единый паттерн campaign / content / term для paid:**
   - `utm_campaign` = кампания (имя или placeholder сети)
   - `utm_content` = ad group / ad set
   - `utm_term` = объявление / keyword (где API позволяет)

3. **`strimix_refid`** задан для сетей со стабильным ad id: Google `{creative}`, Meta `{{ad.id}}`, TikTok `__CID__`.

4. **Кастомные query-параметры Meta** (`placement`, `site_source_name`) вынесены отдельно от канонических UTM — корректно: они попадают в `url_params`, не в source/medium.

### 2.3. Слабые места и несостыковки Excel (критичные)

#### A. Разная семантика `utm_medium` по сетям (главная проблема)

| Сеть | Что сейчас в medium | Что это на самом деле |
|------|---------------------|------------------------|
| Google Ads | `paid_search`, `youtube`, `performance_max`, … | **Inventory / campaign type** — соответствует цели v2 |
| Facebook Ads | `conversions`, `traffic`, `leads`, `impressions`, … | **Campaign objective** — не placement |
| TikTok Ads | `conversions`, `traffic`, `reach`, `video`, … | **Campaign objective** — не placement |
| Email / SMS | `broadcast`, `funnel`, `transactional` | **Тип коммуникации** (другой уровень абстракции) |
| Instagram organic | `bio`, `smm`, `blogger` | **Площадка / формат** внутри платформы |

**Следствие:** нельзя описать одно универсальное channel-правило «medium → traffic_channel» для всех paid-сетей: для Google medium кодирует placement, для Meta/TikTok — objective.

#### B. Несовместимость с текущими system origin rules

Текущий `sys_origin_meta_ads` ожидает medium:  
`cpc | ppc | paid | paid_social | paidsocial | social_paid`.

Excel Meta использует: `conversions`, `traffic`, `leads`, … → **правило не сматчится**, если не сработает `sys_origin_meta_ads_network` по `source=facebook_ads` без medium.

Текущий `sys_origin_google_ads` ожидает medium:  
`cpc | ppc | paid | paid_search | paidsearch`.

Excel Google: `paid_search` → **origin сработает**, но **channel не уточнится** (channel только по `traffic_origin` через `sys_channel_paid_search`).

#### C. Несколько форматов source в одной системе

- Excel: `google_ads`, `facebook_ads` (snake_case, lowercase)
- Разговорная форма / часть custom rules: `Google Ads` (Title Case с пробелом)
- UTM-проекция джобы: `{data_source}` → `FACEBOOK_ADS`, `GOOGLE_ADS` (SCREAMING_SNAKE)

Нужен **один canonical формат в URL** и явные utm-aliasing rules для legacy.

#### D. Рассинхрон Settings vs Links

- Links не покрывает Display, Shopping, Smart, Discovery, большинство Meta objectives, Pinterest, Bing и др.
- Settings полнее, но **нет Bing Ads, LinkedIn Ads, ChatGPT**; Pinterest заполнен частично.

#### E. Пустой `strimix_refid` у Performance Max и Smart

В Settings для PMax и Smart `strimix_refid` пуст — осознанно (Google не отдаёт `{creative}` на этом уровне). Следствия:

- tier 1 матчинга по `strimix_refid` недоступен;
- tier 5 (полный набор UTM-меток) — основной путь;
- при drill-down глубже campaign часто будет `(combined)`.

#### F. Конфликт organic vs paid YouTube

- Paid: `source=google_ads`, `medium=youtube`
- Organic: `source=youtube`, `medium=organic`

Разведено по source корректно, но channel-правила должны явно различать YouTube Ads (paid) и YouTube organic.

#### G. Instagram paid vs organic

- Paid Instagram Direct Leads: `source=facebook_ads`, `medium=instagram_direct_leads`
- Organic: `source=instagram`, `medium=bio|smm|…`

Риск путаницы в отчётах, если не развести origin/channel rules.

#### H. Нет дефолтных channel rules для части Excel-типов

`telegram_ads` + `impressions`, `booklet` + `qr`, `leeloo` + `funnel` и т.д. → fallback `traffic_channel = Other`, если нет custom rules.

---

## 3. Как устроен pipeline сегодня (обязательный контекст для implementer)

```
Сырые метки (URL / коннектор / CRM mapping)
    ↓
[attribution_signal_mappings] — synthetic visits: CRM → canonical labels
    ↓
Стадия utm (traffic_rules) — перезапись канонических меток (per-field)
    ↓
Стадия origin — traffic_origin (first matching rule wins)
    ↓
Стадия channel — traffic_channel (first matching rule wins)
    ↓
Таблицы visits / ad_costs
    ↓
Reporting: матчинг visits↔costs (refid → ad_id → … → UTM tier 5),
            группировка по params (traffic_channel, campaign, …)
```

### 3.1. Свойства стадий traffic_rules

| Стадия | Что меняет | Семантика внутри стадии |
|--------|------------|-------------------------|
| **utm** | source, medium, campaign, content, term, strimix_refid | **Per-field:** каждое поле берётся из первого совпавшего правила, которое это поле задало |
| **origin** | traffic_origin | **First rule wins** целиком |
| **channel** | traffic_channel | **First rule wins** целиком; может матчить `traffic_origin_regex` или utm/ad fields |

### 3.2. Значение `target`

| target | Применение |
|------|------------|
| `visit` | Только таблица `visits` |
| `ad_cost` | Только таблица `ad_costs` |
| `both` | Обе таблицы **независимо** — правило срабатывает на каждой строке, которая матчит условия |

**Важно:** `both` не означает «синхронизировать стороны». Если на `ad_costs` есть строки, а на `visits` нет подходящих — перезапись будет односторонней.

### 3.3. UTM-проекция (sys_utm_projection_*)

- Срабатывает по схеме **all-or-nothing**, только когда **все пять** канонических меток пусты.
- Заполняет `{data_source}`, `(not set)`, `{campaign_name}`, … для non-web ad_costs и synthetic visits с резолвленной группой.
- **Не затирает** уже проставленные в кабинете UTM — если в costs уже есть `google_ads` / `paid_search`, проекция их не трогает.

### 3.4. Почему `sys_channel_paid_search` недостаточен для Google

Правило `sys_channel_paid_search` (priority 2010) матчит `traffic_origin_regex = (google ads|bing ads)` и ставит **Paid Search** для **всех** Google Ads независимо от типа кампании. Это и есть корень проблемы, которую решает v2.

---

## 4. Принципы UTM Naming Convention v2

### 4.1. Три слоя данных (не смешивать)

| Слой | Где хранится | Пример | Назначение |
|------|--------------|--------|------------|
| **Канонические UTM** | source, medium, campaign, content, term, strimix_refid | `google_ads` / `paid_search` | Ключ матчинга visits↔costs, технический контракт |
| **Traffic Origin** | traffic_origin | `Google Ads` | Платформа в UI и отчётах |
| **Traffic Channel** | traffic_channel | `Paid Search`, `Performance Max` | Воронка / агрегированный канал |

**Правило:** в URL и в tracking template — **canonical UTM** (lowercase snake_case). Origin и Channel — **выводятся rules**, display layer может использовать Title Case и пробелы.

### 4.2. Канонический формат строк в UTM

- **Регистр:** lowercase
- **Разделитель слов:** underscore `_`
- **Допустимые символы:** `[a-z0-9_]`
- **Запрещено в v2 URL:** пробелы, Title Case (`Google Ads` в URL — только legacy, нормализуется rules)
- **Legacy:** rules с `(?i)` принимают старые варианты и при необходимости нормализуют на utm-стадии

### 4.3. Canonical `utm_source` для paid платформ (целевой словарь)

| Платформа | utm_source (canonical) |
|-----------|-------------------------|
| Google Ads | `google_ads` |
| Meta (Facebook + Instagram + Messenger ads) | `meta_ads` *(см. open questions: миграция с `facebook_ads`)* |
| TikTok Ads | `tiktok_ads` |
| Bing Ads | `bing_ads` |
| LinkedIn Ads | `linkedin_ads` |
| Telegram Ads | `telegram_ads` |
| Pinterest Ads | `pinterest_ads` |

### 4.4. Семантика полей (единая для всех каналов)

| Поле | Смысл v2 | Paid media | Organic / owned |
|------|----------|------------|-----------------|
| **source** | Платформа или owned-канал | `google_ads`, `meta_ads`, … | `youtube`, `instagram`, `email`, `telegram_channel`, … |
| **medium** | **Подтип размещения / inventory / surface** (paid) или **формат касания** (owned) | Google: `paid_search`, `performance_max`, … Meta v2: `feed`, `instagram_direct`, … *(не objective)* | `organic`, `bio`, `broadcast`, `qr`, `smm`, … |
| **campaign** | Кампания | Динамический placeholder сети | Название рассылки / плейлиста / QR-кампании |
| **content** | Ad set / ad group / блок контента | `{{adset.name}}`, ad group name | Вариант креатива, блок письма |
| **term** | Ad / keyword | `{{ad.name}}`, `{keyword}` | Обычно пусто |
| **strimix_refid** | Ad id для tier-1 матчинга | `{creative}`, `{{ad.id}}`, `__CID__` | Обычно пусто |

### 4.5. Ключевое изменение v2 для Meta и TikTok

**Campaign objective** (`conversions`, `traffic`, `leads`, `impressions`, …) **больше не кодируется в `utm_medium`.**

Objective переносится в одно из мест (решение — open questions):

- префикс в `utm_campaign` (например `conv__{{campaign.name}}`);
- custom query parameter `objective=conversions` (не каноническое поле, только `url_params`);
- не хранится в UTM вовсе, если не нужен в Strimix.

---

## 5. Словарь `utm_medium` v2 (draft)

### 5.1. Google Ads (`source=google_ads`)

| utm_medium (canonical) | traffic_channel (target) | Примечание |
|------------------------|--------------------------|------------|
| `paid_search` | Paid Search | Search, DSA с tracking template |
| `shopping` | Paid Shopping *(новый)* | Shopping campaigns |
| `performance_max` | Performance Max *(новый)* | PMax |
| `youtube` | YouTube Ads *(новый)* | Video / YouTube inventory |
| `demand_gen` | Demand Gen *(новый)* | Demand Gen campaigns |
| `gdn` | Display *(новый)* | Google Display Network |
| `discovery` | Discovery *(новый)* | Legacy; возможен map в Demand Gen позже |
| `smart` | Smart Campaigns *(новый)* | Smart campaigns |
| `app` | App Campaigns *(новый)* | Если добавляется в generator |

**Legacy aliases (utm stage):** `cpc`, `ppc` при `source=google_ads` → нормализовать medium в `paid_search`.

### 5.2. Meta Ads (`source=meta_ads` или legacy `facebook_ads`)

**Целевая логика v2: medium = placement / surface, не objective.**

| utm_medium (v2) | traffic_channel (draft) | Комментарий |
|-----------------|---------------------------|-------------|
| `feed` | Paid Social | Facebook feed |
| `stories` | Paid Social | |
| `reels` | Paid Social | |
| `instagram_feed` | Paid Social | |
| `instagram_stories` | Paid Social | |
| `instagram_reels` | Paid Social | |
| `instagram_direct` | Paid Social | бывш. `instagram_direct_leads` |
| `messenger` | Messenger или Paid Social *(open question)* | |
| `audience_network` | Audience Network *(новый)* | |
| `marketplace` / `catalog` | Paid Social | catalog / marketplace |

**Миграция с Excel v1 (objective as medium):**

| Excel medium (legacy) | Действие v2 |
|----------------------|-------------|
| `conversions` | Не использовать как medium в новых URL |
| `traffic` | То же |
| `leads` | То же |
| `impressions` | То же |
| `catalog_sales` | → `marketplace` или `catalog` |
| `messenger_leads` | → `messenger` |
| `instagram_direct_leads` | → `instagram_direct` |

**Переходный период:** transitional channel rules (priority ~2000) для legacy objective mediums → Paid Social, пока URL в кабинетах не обновлены.

### 5.3. TikTok Ads (`source=tiktok_ads`)

**Целевая логика v2: medium = placement.**

| utm_medium (v2) | traffic_channel |
|-----------------|-----------------|
| `in_feed` | Paid Social |
| `search_results` | Paid Social |
| `pangle` | Audience Network |

Legacy objective mediums (`conversions`, `traffic`, `reach`, `video`) — transitional rules до перевыпуска URL.

### 5.4. Bing Ads (`source=bing_ads`)

| utm_medium | traffic_channel |
|------------|-----------------|
| `paid_search` | Paid Search |

### 5.5. Owned / organic (философия Excel v1 сохраняется)

| source | medium | traffic_origin (draft) | traffic_channel (draft) |
|--------|--------|------------------------|-------------------------|
| `youtube` | `organic` | YouTube | Organic Social |
| `instagram` | `bio` | Instagram | Organic Social |
| `email` | `broadcast` | Email | Email |
| `telegram_channel` | `broadcast` | Telegram | Messenger / Email *(open question)* |
| `booklet` | `qr` | Offline *(custom)* | Offline |

---

## 6. Маппинг UTM → traffic_origin / traffic_channel

### 6.1. Origin (stage=origin, target=both)

**Принцип:** `traffic_origin` = **платформа**, определяется преимущественно по **source**; medium обычно не обязателен.

Примеры целевых правил (priority ~950, ниже custom, выше legacy cpc-rules):

| source_regex | set_traffic_origin |
|--------------|-------------------|
| `(?i)^google_ads$` | Google Ads |
| `(?i)^(meta_ads\|facebook_ads)$` | Meta Ads |
| `(?i)^tiktok_ads$` | TikTok Ads |
| `(?i)^bing_ads$` | Bing Ads |

**Изменение относительно текущих seeds:** добавить source-only origin rules; правила `sys_origin_*_ads` с обязательным medium=`cpc|ppc|…` оставить как **legacy fallback**.

### 6.2. Channel (stage=channel, target=both)

**Принцип v2:** для paid платформ channel определяется парой **source + medium**, а не только `traffic_origin`.

**Предлагаемая шкала priority:**

| Priority | Назначение |
|----------|------------|
| 1800–1899 | utm normalization (stage=utm) |
| 1900–1999 | `(combined)` pass-through |
| **2001–2050** | **Channel by source+medium (NEW)** — Google, Meta placement, TikTok, … |
| 2000 | Legacy Paid Social by origin (Meta/TikTok fallback) |
| 2010 | **Сузить** `sys_channel_paid_search` — убрать Google из origin-only match |

**Примеры NEW channel rules (Google):**

```
sys_channel_google_paid_search:
  source (?i)^google_ads$, medium (?i)^paid_search$ → Paid Search

sys_channel_google_performance_max:
  source (?i)^google_ads$, medium (?i)^performance_max$ → Performance Max

sys_channel_google_youtube:
  source (?i)^google_ads$, medium (?i)^youtube$ → YouTube Ads

sys_channel_google_demand_gen:
  source (?i)^google_ads$, medium (?i)^demand_gen$ → Demand Gen

… shopping, gdn, smart, discovery …
```

**Fallback для Google без распознанного medium:**

- `traffic_channel = Paid Other Google` *(или Paid Search — open question)*

### 6.3. UTM normalization (stage=utm, target=both)

Примеры system utm rules (priority ~850–899):

| rule_id (draft) | Условие | Действие |
|-----------------|---------|----------|
| `sys_utm_alias_google_ads_source` | source `(?i)^google ads$` | set_source `google_ads` |
| `sys_utm_alias_meta_source` | source `(?i)^facebook_ads$` | set_source `meta_ads` |
| `sys_utm_legacy_google_cpc` | source google_ads, medium cpc\|ppc | set_medium `paid_search` |

Опционально `applies_to_web=true` на alias rules для нормализации веб-кликов с legacy URL.

---

## 7. Согласованность visits ↔ ad_costs

### 7.1. Условие успеха v2

Для каждого traffic type из UTM generator:

1. Final URL в рекламном кабинете содержит **canonical UTM**.
2. Коннектор записывает те же `source` / `medium` в строки расходов (**до** или **вместо** проекции, но проекция не затирает заполненные метки).
3. Клик на сайт несёт те же метки → web visit в `visits`.
4. `traffic_rules` с `target=both` дают одинаковые `traffic_origin` и `traffic_channel` на обеих сторонах **при совпадении canonical UTM**.

### 7.2. Когда симметрия намеренно отсутствует

| Ситуация | Поведение |
|----------|-----------|
| PMax без `{creative}` | Матчинг по UTM tier 5; drill-down глубже campaign → `(combined)` |
| CRM synthetic (`Таргет`, Offline, …) | source не совпадает с ad_costs → uncosted visits; нужен `include_uncosted_visits` в отчёте |
| Проекция `{data_source}` без UTM | source=`GOOGLE_ADS` → нужен utm alias → `google_ads` |
| Legacy Meta URL (medium=conversions) | transitional rules до перевыпуска кампаний |

### 7.3. Требование к коннектору Google (отдельная задача)

Если выгрузка расходов **не содержит** UTM из tracking template:

- либо **прокинуть** tracking template fields в `source` / `medium` в `google_ads_ad_costs` / `ad_costs`;
- либо **заполнять medium из API** (`campaign.advertising_channel_type` / аналог) с маппингом на словарь §5.1.

Без этого channel rules по medium сработают только на **web visits**, не на **cost rows**.

---

## 8. Изменения в UTM Generator (продукт)

### 8.1. Новая структура справочника (замена листа Settings)

| Колонка | Описание |
|---------|----------|
| `traffic_type_id` | Стабильный id (`google_ads_search`) |
| `display_name` | Название в UI generator |
| `utm_source` | Canonical |
| `utm_medium` | Canonical |
| `utm_campaign` | Template |
| `utm_content` | Template |
| `utm_term` | Template |
| `strimix_refid` | Template |
| `custom_params` | Non-UTM query keys (placement, …) |
| `traffic_origin` | Read-only preview (по seeds) |
| `traffic_channel` | Read-only preview (по seeds) |
| `status` | `active` / `legacy` / `deprecated` |
| `notes` | Ограничения API (PMax: no creative id) |

### 8.2. Обязательные доработки generator

1. Единый словарь medium с группировкой: Google / Meta / TikTok / Owned.
2. Validation: запрет пробелов и uppercase в source/medium; regex `^[a-z0-9_]+$`.
3. Preview classification: итоговые origin/channel по production seeds (embedded JSON или API).
4. Migration tab: таблица old medium → new medium для Meta/TikTok.
5. Links генерировать **из Settings автоматически** — убрать ручной рассинхрон.
6. Закрыть пробелы: Bing, LinkedIn, все Meta objectives → v2 templates.

---

## 9. Изменения дефолтных traffic_rules (deliverables)

### 9.1. Добавить (новые system seeds)

**UTM normalization (stage=utm, priority ~850–899):**

- Aliases Title Case / legacy → snake_case
- Legacy Google cpc/ppc → paid_search
- Legacy facebook_ads → meta_ads (optional)

**Origin (stage=origin, priority ~950):**

- Source-only rules для paid платформ (§6.1)

**Channel (stage=channel, priority 2001–2050):**

- Google: правила source+medium по §5.1
- Meta/TikTok v2 placement → Paid Social / Messenger / Audience Network
- Transitional legacy objective mediums (deprecated, с датой sunset)

### 9.2. Изменить существующие

| rule_id | Изменение |
|---------|-----------|
| `sys_channel_paid_search` | Убрать `google ads` из `traffic_origin_regex`; оставить Bing fallback или перевести на source+medium |
| `sys_origin_google_ads` | Оставить как legacy для cpc/ppc URL |
| `sys_origin_meta_ads` | Оставить как legacy |

### 9.3. Новые значения traffic_channel

Добавить в документацию и reporting (если enum жёсткий):

- Performance Max
- YouTube Ads
- Demand Gen
- Display
- Paid Shopping
- Smart Campaigns
- Audience Network
- Paid Other Google *(fallback)*

`traffic_origin = Google Ads` **общий** для всех перечисленных Google channel.

### 9.4. Migration SQL для existing projects

1. `migrate-traffic-rules-utm-v2.sql` — insert new rules
2. `deprecate-sys-channel-paid-search-google.sql` — update/deactivate старое правило
3. README: transitional period, порядок deploy

---

## 10. Порядок внедрения (roadmap)

| Фаза | Работы |
|------|--------|
| **0** | Утвердить open questions (отдельный файл) |
| **1** | UTM generator v2 spec + JSON/CSV словарь |
| **2** | Seeds traffic_rules + SQL migrations + тесты regex |
| **3** | Коннектор Google: medium из UTM или campaign_type API |
| **4** | Пилот на одном проекте: URL + job + ad channels report |
| **5** | Rollout + sunset legacy rules |

**Порядок deploy на проекте:**

1. Deploy новых traffic_rules (transitional ON)
2. Run attribution job
3. Обновить tracking templates в рекламных кабинетах
4. Reporting `upgrade-to-v2` при необходимости
5. Ad channels report с `include_uncosted_visits: true` где нужны CRM conversions
6. Через согласованный срок отключить legacy objective medium rules

---

## 11. Критерии приёмки

1. Google Search, PMax, YouTube, Demand Gen в одном проекте имеют **разные** `traffic_channel` при общем `traffic_origin = Google Ads`.
2. Web visit и ad_cost row с **одинаковым canonical UTM** получают одинаковые `traffic_origin` и `traffic_channel`.
3. Legacy URL из Excel v1 (например `facebook_ads` + `conversions`) **не ломаются** до sunset благодаря transitional rules.
4. UTM generator выдаёт только valid canonical tokens.
5. Implementer без контекста чата может работать по этому документу + open questions + словарю medium.

---

## 12. Резюме

Excel v1 **правильно** кодирует Google (medium = placement), но Meta/TikTok кодируют в medium **другой уровень** (campaign objective). UTM Naming v2 **выравнивает medium под placement/inventory** для paid сетей, выносит objective из medium, фиксирует canonical lowercase snake_case в URL, а **traffic_rules** классифицируют channel по **`source + medium`**, а не только по `traffic_origin`. Дефолтное `sys_channel_paid_search` для Google **сужается**; добавляется набор Google-specific channel rules. UTM generator перестраивается как единый словарь с preview classification и legacy migration.

**Открытые решения** — в файле `docs/utm-naming-convention-v2-open-questions.md`.
