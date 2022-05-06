
      
    delete from "faros"."public"."cicd_Deployment"
    where (id) in (
        select (id)
        from "cicd_Deployment__dbt_tmp170208421086"
    );
    

    insert into "faros"."public"."cicd_Deployment" ("origin", "refreshedAt", "uid", "startedAt", "endedAt", "env", "status", "source", "application", "build")
    (
        select "origin", "refreshedAt", "uid", "startedAt", "endedAt", "env", "status", "source", "application", "build"
        from "cicd_Deployment__dbt_tmp170208421086"
    )
  