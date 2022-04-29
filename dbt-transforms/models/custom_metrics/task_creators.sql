
{{ config(materialized='table') }}

with task as (
  select distinct on (task_id)
    task_id,
    creator_identity_id,
    EXTRACT(MONTH FROM task_created_at) as month,
    EXTRACT(YEAR FROM task_created_at) as year
  from {{ ref('base_task') }}
  order by task_id desc
),

with_num_tasks as (
select
  month,
  year,
  creator_identity_id,
  count(*) as num_tasks_created
from task
group by 1, 2, 3
)

select
  month,
  year,
  creator_identity_id,
  num_tasks_created,
  rank() OVER (PARTITION BY month, year ORDER BY num_tasks_created DESC)
  from with_num_tasks
