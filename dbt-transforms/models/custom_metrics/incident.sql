
{{
  config(
    alias='ims_Incident', 
    materialized='incremental',
    unique_key='id',
    ignore_columns={
      'ims_Incident': [
        'id', 
        'severityDetail', 
        'severityCategory', 
        'priorityDetail', 
        'priorityCategory', 
        'statusDetail', 
        'statusCategory'
      ]
    }
  ) 
}}

with task as (
  select *
  from {{ ref('base_task') }}
  {% if is_incremental() %}
    where refreshed_at > coalesce((select max("refreshedAt") from {{ this }}), to_timestamp(0))
  {% endif %}
),

incident_task as (
  select *
  from task
  where type_detail = 'Incident'
)

select
  task_source || '|' || task_uid as "id",
  task_origin as "origin",
  now() as "refreshedAt",
  task_description as "description",
  task_url as "url",
  null::jsonb as "severity",
  ('{"category": "Custom", "detail": "' || task_priority || '"}')::jsonb as "priority",
  task_status as "status",
  task_created_at as "createdAt",
  task_updated_at as "updatedAt",
  null::timestamptz as "acknowledgedAt",
  null::timestamptz as "resolvedAt",
  task_uid as "uid",
  task_name as "title",
  task_source as source
from incident_task
