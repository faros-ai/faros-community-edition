select kcu.table_name as child_table,
    rel_tco.table_name as parent_table,
    string_agg(kcu.column_name, ',') as column
from information_schema.table_constraints tco
join information_schema.key_column_usage kcu
    on tco.constraint_schema = kcu.constraint_schema
    and tco.constraint_name = kcu.constraint_name
join information_schema.referential_constraints rco
    on tco.constraint_schema = rco.constraint_schema
    and tco.constraint_name = rco.constraint_name
join information_schema.table_constraints rel_tco
    on rco.unique_constraint_schema = rel_tco.constraint_schema
    and rco.unique_constraint_name = rel_tco.constraint_name
where tco.constraint_type = 'FOREIGN KEY'
    and kcu.table_schema = 'public'
    and rel_tco.table_schema = 'public'
group by kcu.table_schema,
    kcu.table_name,
    rel_tco.table_name,
    rel_tco.table_schema,
    kcu.constraint_name
order by kcu.table_schema,
    kcu.table_name;
