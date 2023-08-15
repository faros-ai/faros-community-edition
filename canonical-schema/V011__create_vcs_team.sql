create table "vcs_Team" (
  id text generated always as (pkey(source, slug)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text,
  name text,
  slug text not null,
  description text,
  privacy text,
  url text,
  source text
);

create table "vcs_TeamMember" (
  id text generated always as (pkey(team, "user")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  state text,
  role text,
  "user" text not null,
  team text not null,
  source text
);


alter table "vcs_TeamMember" add foreign key ("user") references "vcs_User"(id);
alter table "vcs_TeamMember" add foreign key (team) references "vcs_Team"(id);