create table "elephant_Team" (
  id text generated always as (pkey(source, uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  name text not null,
  slug text not null,
  source text,
  organization text
);

alter table "elephant_Team" add foreign key (organization) references "vcs_Organization"(id);

