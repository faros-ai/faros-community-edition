
  create view "faros"."public"."base_pipeline__dbt_tmp" as (
    select
    "id" as id,
    "name" as name
from "faros"."public"."cicd_Pipeline"
  );