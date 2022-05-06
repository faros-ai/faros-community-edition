

with build as (
  select *
  from "faros"."public"."base_build"
  
    where refreshed_at > coalesce((select max("refreshedAt") from "faros"."public"."cicd_Deployment"), to_timestamp(0))
  
),
pipeline as (
  select *
  from "faros"."public"."base_pipeline"
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