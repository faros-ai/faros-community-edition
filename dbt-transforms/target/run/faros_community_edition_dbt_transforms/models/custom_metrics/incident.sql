
      
    delete from "faros"."public"."ims_Incident"
    where (id) in (
        select (id)
        from "ims_Incident__dbt_tmp170208499876"
    );
    

    insert into "faros"."public"."ims_Incident" ("origin", "refreshedAt", "uid", "title", "description", "url", "severity", "priority", "status", "createdAt", "updatedAt", "acknowledgedAt", "resolvedAt", "source")
    (
        select "origin", "refreshedAt", "uid", "title", "description", "url", "severity", "priority", "status", "createdAt", "updatedAt", "acknowledgedAt", "resolvedAt", "source"
        from "ims_Incident__dbt_tmp170208499876"
    )
  