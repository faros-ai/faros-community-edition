
{{
  config(
    alias='cicd_Deployment', 
    materialized='incremental',
    unique_key='id',
    ignore_columns={
      'cicd_Deployment': [
        'id',
        'envDetail',
        'envCategory',
        'statusDetail',
        'statusCategory'
      ]
    }
  ) 
}}

with build as (
  select *
  from {{ ref('base_build') }}
  {% if is_incremental() %}
    where refreshed_at > coalesce((select max("refreshedAt") from {{ this }}), to_timestamp(0))
  {% endif %}
),
pipeline as (
  select *
  from {{ ref('base_pipeline') }}
  where name like '%deploy%'
),
build_deployment as (
  select
    b.*,
    p.name as pipeline_name
  from build b
  join pipeline p
  on b.pipeline = p.id
)

select
  'transformed_build' || '|' || uid as "id",
  origin as "origin",
  now() as "refreshedAt",
  uid as "uid",
  started_at as "startedAt",
  ended_at as "endedAt",
  null::jsonb as "env",
  status as "status",
  'transformed_build' as "source",
  null as "application",
  id as "build"
from build_deployment
