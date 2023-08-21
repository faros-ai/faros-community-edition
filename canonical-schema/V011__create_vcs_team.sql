create table "vcs_Team" (
  id text generated always as (pkey(source, uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text,
  name text,
  description text,
  source text
);

create table "vcs_TeamMembership" (
  id text generated always as (pkey(team, "user")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "user" text not null,
  team text not null
);


alter table "vcs_TeamMembership" add foreign key ("user") references "vcs_User"(id);
alter table "vcs_TeamMembership" add foreign key (team) references "vcs_Team"(id);