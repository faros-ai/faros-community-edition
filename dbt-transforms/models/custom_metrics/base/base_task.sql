select
    id as task_id,
    uid as task_uid,
    name as task_name,
    origin as task_origin,
    description as task_description,
    url as task_url,
    status as task_status,
    priority as task_priority,
    "createdAt" as task_created_at,
    "updatedAt" as task_updated_at,
    "refreshedAt" as refreshed_at,
    creator as creator_identity_id,
    "typeDetail" as type_detail,
    source as task_source
from {{ source('raw', 'tms_Task') }}
