create table "vcs_Label" (
  id text generated always as (pkey(name)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  name text
);

create table "vcs_PullRequestLabel" (
  id text generated always as (pkey(label, "pullRequest")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  label text,
  "pullRequest" text
);

alter table "vcs_PullRequestLabel" add foreign key (label) references "vcs_Label"(id);
alter table "vcs_PullRequestLabel" add foreign key ("pullRequest") references "vcs_PullRequest"(id);

create index "vcs_PullRequestLabel_origin_idx" on "vcs_PullRequestLabel"(origin);
create index "vcs_PullRequestLabel_label_idx" on "vcs_PullRequestLabel"(label);
create index "vcs_PullRequestLabel_pullRequest_idx" on "vcs_PullRequestLabel"("pullRequest");

comment on column "vcs_Label".id is 'generated';
comment on column "vcs_PullRequestLabel".id is 'generated';
