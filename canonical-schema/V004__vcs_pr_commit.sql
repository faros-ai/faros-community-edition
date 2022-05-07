create table "vcs_PullRequestCommitAssociation" (
  id text generated always as (pkey("pullRequest", commit)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "pullRequest" text,
  commit text
);

alter table "vcs_PullRequestCommitAssociation" add foreign key ("pullRequest") references "vcs_PullRequest"(id);
alter table "vcs_PullRequestCommitAssociation" add foreign key (commit) references "vcs_Commit"(id);


create index "vcs_PullRequestCommitAssociation_origin_idx" on "vcs_PullRequestCommitAssociation"(origin);
create index "vcs_PullRequestCommitAssociation_pullRequest_idx" on "vcs_PullRequestCommitAssociation"("pullRequest");
create index "vcs_PullRequestCommitAssociation_commit_idx" on "vcs_PullRequestCommitAssociation"(commit);

comment on column "vcs_PullRequestCommitAssociation".id is 'generated';
