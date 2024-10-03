-- Create vcs_UserEmail
create table "vcs_UserEmail" (
  id text generated always as (pkey(email, "user")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  email text not null,
  "user" text not null,
  foreign key ("user") references "vcs_User"(id)
);
-- Create indexes for vcs_UserEmail
create index "vcs_UserEmail_origin_idx" on "vcs_UserEmail"(origin);
create index "vcs_UserEmail_email_idx" on "vcs_UserEmail"(email);
create index "vcs_UserEmail_user_idx" on "vcs_UserEmail"("user");
-- Comments for vcs_UserEmail
comment on column "vcs_UserEmail".id is 'generated';

-- Create vcs_PullRequestReviewRequest
create table "vcs_PullRequestReviewRequest" (
  id text generated always as (pkey("pullRequest", "requestedReviewer")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "pullRequest" text not null,
  "requestedReviewer" text not null,
  foreign key ("pullRequest") references "vcs_PullRequest"(id),
  foreign key ("requestedReviewer") references "vcs_User"(id)
);
-- Create indexes for vcs_PullRequestReviewRequest
create index "vcs_PullRequestReviewRequest_origin_idx" on "vcs_PullRequestReviewRequest"(origin);
create index "vcs_PullRequestReviewRequest_pullRequest_idx" on "vcs_PullRequestReviewRequest"("pullRequest");
create index "vcs_PullRequestReviewRequest_requestedReviewer_idx" on "vcs_PullRequestReviewRequest"("requestedReviewer");
-- Comments for vcs_PullRequestReviewRequest
comment on column "vcs_PullRequestReviewRequest".id is 'generated';

create table "vcs_File" (
  id text generated always as (pkey(uid, repository)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  path text,
  extension text,
  repository text not null,
  foreign key (repository) references "vcs_Repository"(id)
);
-- Create index for vcs_File
create index "vcs_File_uid_idx" on "vcs_File"(uid);
-- Comments for vcs_File
comment on column "vcs_File".id is 'generated';

-- Create vcs_OrganizationTool
create table "vcs_OrganizationTool" (
  id text generated always as (pkey("organization", tool::text)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "organization" text not null,
  tool jsonb not null,
  inactive boolean,
  foreign key ("organization") references "vcs_Organization"(id)
);
alter table "vcs_OrganizationTool" add column "toolCategory" text generated always as ((tool->>'category')::text) stored;
alter table "vcs_OrganizationTool" add column "toolDetail" text generated always as ((tool->>'detail')::text) stored;
-- Create index for vcs_OrganizationTool
create index "vcs_OrganizationTool_organization_idx" on "vcs_OrganizationTool"("organization");
-- Comments for vcs_OrganizationTool
comment on column "vcs_OrganizationTool".id is 'generated';
comment on column "vcs_OrganizationTool"."toolCategory" is 'generated';
comment on column "vcs_OrganizationTool"."toolDetail" is 'generated';

-- Create vcs_UserTool
create table "vcs_UserTool" (
  id text generated always as (pkey("user", "organization", tool::text)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "user" text not null,
  "organization" text not null,
  tool jsonb not null,
  inactive boolean,
  "startedAt" timestamptz,
  "endedAt" timestamptz,
  foreign key ("user") references "vcs_User"(id),
  foreign key ("organization") references "vcs_Organization"(id)
);
alter table "vcs_UserTool" add column "toolCategory" text generated always as ((tool->>'category')::text) stored;
alter table "vcs_UserTool" add column "toolDetail" text generated always as ((tool->>'detail')::text) stored;
-- Create indexes for vcs_UserTool
create index "vcs_UserTool_user_idx" on "vcs_UserTool"("user");
create index "vcs_UserTool_organization_idx" on "vcs_UserTool"("organization");
-- Comments for vcs_UserTool
comment on column "vcs_UserTool".id is 'generated';
comment on column "vcs_UserTool"."toolCategory" is 'generated';
comment on column "vcs_UserTool"."toolDetail" is 'generated';

-- Create vcs_UserToolUsage
create table "vcs_UserToolUsage" (
  id text generated always as (
    pkey(
      "userTool",
      trunc(extract(epoch from "usedAt" at time zone 'UTC')*1000)::text
    )
  ) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  "userTool" text not null,
  "usedAt" timestamptz not null,
  branch text,
  repository text,
  file text,
  "charactersAdded" integer,
  foreign key ("userTool") references "vcs_UserTool"(id),
  foreign key (branch) references "vcs_Branch"(id),
  foreign key (repository) references "vcs_Repository"(id),
  foreign key (file) references "vcs_File"(id)
);
-- Create indexes for vcs_UserToolUsage
create index "vcs_UserToolUsage_userTool_idx" on "vcs_UserToolUsage"("userTool");
create index "vcs_UserToolUsage_usedAt_idx" on "vcs_UserToolUsage"("usedAt");
-- Comments for vcs_UserToolUsage
comment on column "vcs_UserToolUsage".id is 'generated';

-- Create faros_Tag
create table "faros_Tag" (
  id text generated always as (pkey(uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  key text,
  value text
);
-- Create indexes for faros_Tag
create index "faros_Tag_key_idx" on "faros_Tag"(key);
create index "faros_Tag_value_idx" on "faros_Tag"(value);
-- Comments for faros_Tag
comment on column "faros_Tag".id is 'generated';

-- Create faros_MetricDefinition
create table "faros_MetricDefinition" (
  id text generated always as (pkey(uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  name text,
  description text,
  "valueType" jsonb,
  url text,
  "valueSource" jsonb
);
alter table "faros_MetricDefinition" add column "valueTypeCategory" text generated always as (("valueType"->>'category')::text) stored;
alter table "faros_MetricDefinition" add column "valueTypeDetail" text generated always as (("valueType"->>'detail')::text) stored;
alter table "faros_MetricDefinition" add column "valueSourceCategory" text generated always as (("valueSource"->>'category')::text) stored;
alter table "faros_MetricDefinition" add column "valueSourceDetail" text generated always as (("valueSource"->>'detail')::text) stored;
-- Create indexes for faros_MetricDefinition
create index "faros_MetricDefinition_name_idx" on "faros_MetricDefinition"(name);
create index "faros_MetricDefinition_valueType_idx" on "faros_MetricDefinition"("valueType");
-- Comments for faros_MetricDefinition
comment on column "faros_MetricDefinition".id is 'generated';
comment on column "faros_MetricDefinition"."valueTypeCategory" is 'generated';
comment on column "faros_MetricDefinition"."valueTypeDetail" is 'generated';
comment on column "faros_MetricDefinition"."valueSourceCategory" is 'generated';
comment on column "faros_MetricDefinition"."valueSourceDetail" is 'generated';

-- Create faros_MetricValue
create table "faros_MetricValue" (
  id text generated always as (pkey(definition, uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  value text,
  "computedAt" timestamptz,
  definition text,
  foreign key (definition) references "faros_MetricDefinition"(id)
);
-- Create indexes for faros_MetricValue
create index "faros_MetricValue_definition_idx" on "faros_MetricValue"(definition);
create index "faros_MetricValue_computedAt_idx" on "faros_MetricValue"("computedAt");
-- Comments for faros_MetricValue
comment on column "faros_MetricValue".id is 'generated';

-- Create faros_MetricValueTag
create table "faros_MetricValueTag" (
  id text generated always as (pkey(value, tag)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  value text,
  tag text,
  foreign key (value) references "faros_MetricValue"(id),
  foreign key (tag) references "faros_Tag"(id)
);
-- Create indexes for faros_MetricValueTag
create index "faros_MetricValueTag_value_idx" on "faros_MetricValueTag"(value);
create index "faros_MetricValueTag_tag_idx" on "faros_MetricValueTag"(tag);
-- Comments for faros_MetricValueTag
comment on column "faros_MetricValueTag".id is 'generated';

-- Create compute_ApplicationMetric
create table "compute_ApplicationMetric" (
  id text generated always as (pkey(application, value)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  application text not null,
  value text not null,
  foreign key (application) references "compute_Application"(id),
  foreign key (value) references "faros_MetricValue"(id)
);
-- Create indexes for compute_ApplicationMetric
create index "compute_ApplicationMetric_application_idx" on "compute_ApplicationMetric"(application);
create index "compute_ApplicationMetric_value_idx" on "compute_ApplicationMetric"(value);
-- Comments for compute_ApplicationMetric
comment on column "compute_ApplicationMetric".id is 'generated';
