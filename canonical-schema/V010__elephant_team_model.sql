create table "elephant_TeamRepositoryAssociation" (
  id text generated always as (pkey(team, repository)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  team text not null,
  repository text not null
);
alter table "elephant_TeamRepositoryAssociation" add foreign key (team) references "ims_Team"(id);
alter table "elephant_TeamRepositoryAssociation" add foreign key (repository) references "vcs_Repository"(id);
