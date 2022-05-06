
  create view "faros"."public"."base_build__dbt_tmp" as (
    select
    "id" as id,
    "origin" as origin,
    "refreshedAt" as refreshed_at,
    "uid" as uid,
    "name" as name,
    "number" as number,
    "createdAt" as created_at,
    "startedAt" as started_at,
    "endedAt" as ended_at,
    "status" as status,
    "url" as url,
    "pipeline" as pipeline,
    "statusDetail" as status_detail,
    "statusCategory" as status_category
from "faros"."public"."cicd_Build"
  );