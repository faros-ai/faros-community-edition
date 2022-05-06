select
    "id" as id,
    "name" as name
from {{ source('raw', 'cicd_Pipeline') }}
