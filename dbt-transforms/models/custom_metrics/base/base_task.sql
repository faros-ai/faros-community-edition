select
    id as task_id,
    uid as task_uid,
    name as task_name,
    status as task_status,
    "createdAt" as task_created_at,
    creator as creator_identity_id,
    "statusChangedAt" as task_status_changed_at,
    "statusChangelog" as status_changelog,
    "statusCategory" as status_category,
    "statusDetail" as status_detail
from {{ source('raw', 'tms_Task') }}
