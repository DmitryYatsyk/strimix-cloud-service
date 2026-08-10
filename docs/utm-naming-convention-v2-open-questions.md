# UTM Naming Convention v2 — открытые вопросы

**Статус:** не утверждено — решения блокируют финальный список seeds и изменения UTM generator.  
**Связанный документ:** [utm-naming-convention-v2-tz.md](./utm-naming-convention-v2-tz.md)

Перед началом реализации (код, seeds, generator) по каждому пункту нужно зафиксировать решение, владельца и дату.

---

## OQ-1. Canonical source для Meta: `facebook_ads` или `meta_ads`?

**Контекст.** Excel v1 использует `facebook_ads`. Система классификации использует display name `Meta Ads` как `traffic_origin`. Проекция джобы пишет `FACEBOOK_ADS` / `{data_source}`.

**Варианты:**

| Вариант | Плюсы | Минусы |
|---------|-------|--------|
| **A. Canonical `meta_ads`** | Один source для FB + IG + Messenger ads; соответствует бренду Meta | Нужна миграция URL и alias `facebook_ads` → `meta_ads` |
| **B. Оставить `facebook_ads`** | Меньше изменений в существующих tracking templates | Название не отражает Instagram; путаница в документации |
| **C. Два source: `facebook_ads` и `instagram_ads`** | Явное разделение поверхностей | Усложнение origin/channel rules; дубли в отчётах |

**Рекомендация (draft TZ):** A — canonical `meta_ads`, transitional utm alias для `facebook_ads`.

**Решение:** _не принято_

**Зависимости:** utm alias rules, `sys_origin_meta_ads_network`, UTM generator Settings, документация для клиентов.

---

## OQ-2. Куда переносить campaign objective Meta / TikTok (legacy medium)?

**Контекст.** В Excel v1 `utm_medium` = `conversions`, `traffic`, `leads`, … — это **objective**, не placement. В v2 medium зарезервирован под placement/inventory.

**Варианты:**

| Вариант | Пример | Плюсы | Минусы |
|---------|--------|-------|--------|
| **A. Префикс в utm_campaign** | `conv__{{campaign.name}}` | Остаётся в canonical labels; видно в отчётах по campaign | Засоряет campaign dimension; нужны правила парсинга |
| **B. Custom query param** | `objective=conversions` | Не ломает medium; гибко | Не участвует в UTM tier-5 матчинге; только `url_params` |
| **C. Не хранить в UTM** | — | Простейшая схема medium | Objective недоступен в Strimix без join к ad platform API |
| **D. Хранить в utm_content** | `conv__{{adset.name}}` | — | Смешивает placement и objective |

**Рекомендация (draft TZ):** B или C — зависит от продуктовой потребности анализировать objective в Strimix.

**Решение:** _не принято_

**Зависимости:** Meta/TikTok templates в generator, transitional rules для legacy medium.

---

## OQ-3. Messenger / Messenger Leads → какой traffic_channel?

**Контекст.** Meta placement `messenger` / бывший `messenger_leads`. В seeds уже есть channel `Messenger` для origin Telegram/WhatsApp/Viber.

**Варианты:**

| Вариант | traffic_channel |
|---------|-----------------|
| **A** | Messenger (единый с Telegram/WhatsApp) |
| **B** | Paid Social (все Meta paid в одном канале) |
| **C** | Отдельный Paid Messenger |

**Рекомендация (draft TZ):** A или B — зависит от того, как клиенты строят воронку в отчётах.

**Решение:** _не принято_

---

## OQ-4. Google Discovery → отдельный channel или map в Demand Gen?

**Контекст.** Excel v1 имеет отдельный medium `discovery`. Google переводит часть inventory в Demand Gen.

**Варианты:**

| Вариант | Поведение |
|---------|-----------|
| **A** | Отдельный `traffic_channel = Discovery` |
| **B** | Map `medium=discovery` → Demand Gen |
| **C** | Deprecated medium; только `demand_gen` в новых URL |

**Решение:** _не принато_

---

## OQ-5. Fallback для Google Ads без распознанного medium

**Контекст.** Старые URL, incomplete tracking template, или costs без UTM после проекции `{data_source}` + `(not set)`.

**Варианты:**

| Вариант | traffic_channel |
|---------|-----------------|
| **A** | Paid Other Google |
| **B** | Paid Search (как сейчас через origin-only rule) |
| **C** | Other (generic fallback) |

**Рекомендация (draft TZ):** A — явно отделяет «неизвестный Google paid» от Search.

**Решение:** _не принято_

---

## OQ-6. Display names traffic_channel: Title Case vs snake_case

**Контекст.** UTM medium canonical = `performance_max` (snake_case). В UI отчётов сегодня channel = `Paid Search`, `Organic Social` (Title Case с пробелами).

**Варианты:**

| Вариант | Пример channel |
|---------|----------------|
| **A** | Title Case в `traffic_channel`: `Performance Max`, `YouTube Ads` |
| **B** | snake_case в данных = medium clone: `performance_max` |
| **C** | Два слоя: canonical code + display label (отдельная колонка / param metadata) |

**Рекомендация (draft TZ):** A — консистентно с текущими seeds (`Paid Search`, `Paid Social`).

**Решение:** _не принято_

---

## OQ-7. Коннектор Google: UTM из кабинета vs campaign_type из API

**Контекст.** Channel rules v2 на стороне **ad_costs** работают только если в строках расходов есть правильный `medium`. Web visits могут иметь UTM, а costs — нет.

**Варианты:**

| Вариант | Описание |
|---------|----------|
| **A** | Требовать UTM в tracking template; коннектор парсит source/medium в costs |
| **B** | Коннектор заполняет medium из `advertising_channel_type` API → словарь §5.1 TZ |
| **C** | A + B: UTM приоритетнее; API fallback если UTM пуст |

**Рекомендация (draft TZ):** C.

**Решение:** _не принято_

**Зависимости:** google ads connector, cost job merge logic, тесты на PMax/Smart/Search rows.

---

## OQ-8. Срок transitional rules для legacy Meta/TikTok objective mediums

**Контекст.** Пока URL в кабинетах не обновлены, нужны rules: `facebook_ads` + `conversions` → Paid Social.

**Вопросы:**

1. Минимальный срок поддержки legacy (30 / 90 / 180 дней / бессрочно до ручного отключения)?
2. Нужен ли флаг `is_active=false` по дате в migration SQL или процесс вручную?
3. Нужно ли логировать в job/count отчёт «сколько строк ещё на legacy medium»?

**Решение:** _не принято_

---

## OQ-9. Telegram Channel / Bot / Leeloo — один traffic_channel или разные?

**Контекст.** Excel: `telegram_channel` + `broadcast`, `telegram_bot` + `funnel`, `leeloo` + `funnel`. Seeds: channel `Messenger` для telegram origin.

**Варианты:**

| source | Вариант A | Вариант B |
|--------|-----------|-----------|
| telegram_channel broadcast | Messenger | Email-like «Broadcast» |
| telegram_bot funnel | Messenger | Messenger |
| leeloo funnel | Other / CRM | Messenger |

**Решение:** _не принято_

---

## OQ-10. Нужен ли отдельный traffic_channel «Paid Shopping» vs «Paid Search»?

**Контекст.** Google Shopping в Excel: `medium=shopping`. В высокоуровневых отчётах Shopping иногда объединяют с Search.

**Варианты:**

| Вариант | Поведение |
|---------|-----------|
| **A** | Отдельный Paid Shopping |
| **B** | Map shopping → Paid Search |

**Решение:** _не принято_

---

## OQ-11. Bing Ads в scope v2 первой волны?

**Контекст.** В Excel v1 Bing отсутствует. `sys_origin_bing_ads` и `sys_channel_paid_search` для Bing уже есть в seeds.

**Вопрос:** включать Bing templates в generator v2 в первой волне или отложить?

**Решение:** _не принято_

---

## OQ-12. Порядок приоритетов custom vs system rules при миграции

**Контекст.** У клиентов уже есть custom rules (deal_source, Таргет, facebook_cpc, Threads, …). Новые system seeds v2 не должны их ломать.

**Вопросы:**

1. Новые system Google channel rules — priority 2001+ (выше custom 400–500?) или custom всегда < 1000 wins?
2. Нужен ли документ «какие custom rules проверить при upgrade на v2»?

**Текущая конвенция:** custom `priority < 1000` побеждает system.

**Решение:** _не принято_ (подтвердить, что v2 seeds идут только в диапазон 2001+ / 850+ utm / 950 origin)

---

## Чеклист перед стартом реализации

- [ ] OQ-1 … OQ-12: решение записано, owner assigned
- [ ] Утверждён словарь medium v2 (минимум Google + Meta transitional)
- [ ] Утверждён список новых traffic_channel values для reporting UI
- [ ] Утверждён scope коннектора Google (OQ-7)
- [ ] Утверждён sunset plan legacy Meta medium (OQ-8)
