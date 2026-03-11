begin

declare _project_name string default '@GCP_PROJECT_NAME';
declare _dataset_name string default '@GPC_BQ_DATASET_NAME';

-- Process Google Sheets
begin

declare query string;
declare query_template string;

-- Delete all costs
set query_template = """
delete from `<project_name>.<dataset_name>.ad_costs`
where data_source = 'GOOGLE_SHEETS'
""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

-- Insert updated costs
set query_template = """
insert into `<project_name>.<dataset_name>.ad_costs` (
  date,
  source,
  medium,
  campaign,
  content,
  term,
  strimix_refid,
  cost,
  currency,
  impressions,
  reach,
  clicks,
  click_delay,
  data_source
)
select
  date,
  source,
  medium,
  campaign,
  content,
  term,
  strimix_refid,
  round(cost,2) cost,
  currency,
  impressions,
  reach,
  clicks,
  click_delay,
  'GOOGLE_SHEETS' data_source
from `<project_name>.<dataset_name>.additional_ad_costs_gs`
where date is not null""";

set query = replace(query_template, '<project_name>', _project_name);
set query = replace(query, '<dataset_name>', _dataset_name);

execute immediate (query);

end;

end;