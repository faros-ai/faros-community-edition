-- qa models --
create table "qa_CodeQuality" (
    id text generated always as (pkey(uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    bugs jsonb,
    "branchCoverage" jsonb,
    "codeSmells" jsonb,
    complexity jsonb,
    coverage jsonb,
    duplications jsonb,
    "duplicatedBlocks" jsonb,
    "lineCoverage" jsonb,
    "securityHotspots" jsonb,
    vulnerabilities jsonb,
    "createdAt" timestamptz,
    "pullRequest" text,
    repository text
  );
create table "qa_TestCase" (
    id text generated always as (pkey(source, uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    name text,
    description text,
    source text,
    before jsonb,
    after jsonb,
    tags jsonb,
    type jsonb,
    task text
  );
create table"qa_TestCaseResult" (
    id text generated always as (pkey("testExecution", uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    description text,
    "startedAt" timestamptz,
    "endedAt" timestamptz,
    status jsonb,
    "testCase" text,
    "testExecution" text
  );
create table "qa_TestCaseStep" (
    id text generated always as (pkey("testCase", uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    name text,
    description text,
    data text,
    result text,
    "testCase" text
  );
create table "qa_TestCaseStepResult" (
  id text generated always as (pkey("testResult", uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    status jsonb,
    "testStep" text,
    "testResult" text
  );
create table "qa_TestExecution" (
    id text generated always as (pkey(source, uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    name text,
    description text,
    source text,
    "startedAt" timestamptz,
    "endedAt" timestamptz,
    status jsonb,
    environments jsonb,
    "testCaseResultsStats" jsonb,
    "deviceInfo" jsonb,
    tags jsonb,
    suite text,
    task text,
    build text
  );
create table "qa_TestExecutionCommitAssociation" (
    id text generated always as (pkey(commit, "testExecution")) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "testExecution" text,
    commit text
  );
create table "qa_TestSuite" (
    id text generated always as (pkey(source, uid)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    uid text not null,
    name text,
    description text,
    source text,
    tags jsonb,
    type jsonb,
    task text
  );
create table "qa_TestSuiteTestCaseAssociation" (
    id text generated always as (pkey("testCase", "testSuite")) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "testSuite" text,
    "testCase" text
  );
create table "tms_TaskTestCaseResultAssociation" (
    id text generated always as (pkey("defect", "testCaseResult")) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    defect text,
    "testCaseResult" text
  );

-- foreign keys --
alter table "qa_CodeQuality" add foreign key ("pullRequest") references "vcs_PullRequest"(id);
alter table "qa_CodeQuality" add foreign key (repository) references "vcs_Repository"(id);
alter table "qa_TestCase" add foreign key (task) references "tms_Task"(id);
alter table "qa_TestCaseResult" add foreign key ("testCase") references "qa_TestCase"(id);
alter table "qa_TestCaseResult" add foreign key ("testExecution") references "qa_TestExecution"(id);
alter table "qa_TestCaseStep" add foreign key ("testCase") references "qa_TestCase"(id);
alter table "qa_TestCaseStepResult" add foreign key ("testStep") references "qa_TestCaseStep"(id);
alter table "qa_TestCaseStepResult" add foreign key ("testResult") references "qa_TestCaseResult"(id);
alter table "qa_TestExecution" add foreign key (suite) references "qa_TestSuite"(id);
alter table "qa_TestExecution" add foreign key (task) references "tms_Task"(id);
alter table "qa_TestExecution" add foreign key (build) references "cicd_Build"(id);
alter table "qa_TestExecutionCommitAssociation" add foreign key ("testExecution") references "qa_TestExecution"(id);
alter table "qa_TestExecutionCommitAssociation" add foreign key (commit) references "vcs_Commit"(id);
alter table "qa_TestSuite" add foreign key (task) references "tms_Task"(id);
alter table "qa_TestSuiteTestCaseAssociation" add foreign key ("testSuite") references "qa_TestSuite"(id);
alter table "qa_TestSuiteTestCaseAssociation" add foreign key ("testCase") references "qa_TestCase"(id);
alter table "tms_TaskTestCaseResultAssociation" add foreign key (defect) references "tms_Task"(id);
alter table "tms_TaskTestCaseResultAssociation" add foreign key ("testCaseResult") references "qa_TestCaseResult"(id);

comment on column "qa_CodeQuality".id is 'generated';
comment on column "qa_TestCase".id is 'generated';
comment on column "qa_TestCaseResult".id is 'generated';
comment on column "qa_TestCaseStep".id is 'generated';
comment on column "qa_TestCaseStepResult".id is 'generated';
comment on column "qa_TestExecution".id is 'generated';
comment on column "qa_TestExecutionCommitAssociation".id is 'generated';
comment on column "qa_TestSuite".id is 'generated';
comment on column "qa_TestSuiteTestCaseAssociation".id is 'generated';
comment on column "tms_TaskTestCaseResultAssociation".id is 'generated';

-- indices --
create index "qa_CodeQuality_origin_idx" on "qa_CodeQuality"(origin);
create index "qa_CodeQuality_uid_idx" on "qa_CodeQuality"(uid);
create index "qa_CodeQuality_createdAt_idx" on "qa_CodeQuality"("createdAt");
create index "qa_CodeQuality_pull_request_idx" on "qa_CodeQuality"("pullRequest");
create index "qa_CodeQuality_repository_idx" on "qa_CodeQuality"(repository);
create index "qa_TestCase_origin_idx" on "qa_TestCase"(origin);
create index "qa_TestCase_uid_idx" on "qa_TestCase"(uid);
create index "qa_TestCase_source_idx" on "qa_TestCase"(source);
create index "qa_TestCase_before_idx" on "qa_TestCase" using gin(before);
create index "qa_TestCase_after_idx" on "qa_TestCase" using gin(after);
create index "qa_TestCase_tags_idx" on "qa_TestCase" using gin(tags);
create index "qa_TestCase_type_idx" on "qa_TestCase" using gin(type);
create index "qa_TestCase_task_idx" on "qa_TestCase"(task);
create index "qa_TestCaseResult_origin_idx" on "qa_TestCaseResult"(origin);
create index "qa_TestCaseResult_uid_idx" on "qa_TestCaseResult"(uid);
create index "qa_TestCaseResult_startedAt_idx" on "qa_TestCaseResult"("startedAt");
create index "qa_TestCaseResult_endedAt_idx" on "qa_TestCaseResult"("endedAt");
create index "qa_TestCaseResult_status_idx" on "qa_TestCaseResult" using gin(status);
create index "qa_TestCaseResult_testCase_idx" on "qa_TestCaseResult"("testCase");
create index "qa_TestCaseResult_testExecution_idx" on "qa_TestCaseResult"("testExecution");
create index "qa_TestCaseStep_origin_idx" on "qa_TestCaseStep"(origin);
create index "qa_TestCaseStep_uid_idx" on "qa_TestCaseStep"(uid);
create index "qa_TestCaseStep_testCase_idx" on "qa_TestCaseStep"("testCase");
create index "qa_TestCaseStepResult_origin_idx" on "qa_TestCaseStepResult"(origin);
create index "qa_TestCaseStepResult_uid_idx" on "qa_TestCaseStepResult"(uid);
create index "qa_TestCaseStepResult_status_idx" on "qa_TestCaseStepResult" using gin(status);
create index "qa_TestCaseStepResult_testStep_idx" on "qa_TestCaseStepResult"("testStep");
create index "qa_TestCaseStepResult_testResult_idx" on "qa_TestCaseStepResult"("testResult");
create index "qa_TestExecution_origin_idx" on "qa_TestExecution"(origin);
create index "qa_TestExecution_uid_idx" on "qa_TestExecution"(uid);
create index "qa_TestExecution_source_idx" on "qa_TestExecution"(source);
create index "qa_TestExecution_startedAt_idx" on "qa_TestExecution"("startedAt");
create index "qa_TestExecution_endedAt_idx" on "qa_TestExecution"("endedAt");
create index "qa_TestExecution_status_idx" on "qa_TestExecution" using gin(status);
create index "qa_TestExecution_environments_idx" on "qa_TestExecution" using gin(environments);
create index "qa_TestExecution_tags_idx" on "qa_TestExecution" using gin(tags);
create index "qa_TestExecution_suite_idx" on "qa_TestExecution"(suite);
create index "qa_TestExecution_task_idx" on "qa_TestExecution"(task);
create index "qa_TestExecution_build_idx" on "qa_TestExecution"(build);
create index "qa_TestExecutionCommitAssociation_origin_idx" on "qa_TestExecutionCommitAssociation"(origin);
create index "qa_TestExecutionCommitAssociation_testExecution_idx" on "qa_TestExecutionCommitAssociation"("testExecution");
create index "qa_TestExecutionCommitAssociation_commit_idx" on "qa_TestExecutionCommitAssociation"(commit);
create index "qa_TestSuite_origin_idx" on "qa_TestSuite"(origin);
create index "qa_TestSuite_uid_idx" on "qa_TestSuite"(uid);
create index "qa_TestSuite_source_idx" on "qa_TestSuite"(source);
create index "qa_TestSuite_tags_idx" on "qa_TestSuite" using gin(tags);
create index "qa_TestSuite_type_idx" on "qa_TestSuite" using gin(type);
create index "qa_TestSuite_task_idx" on "qa_TestSuite"(task);
create index "qa_TestSuiteTestCaseAssociation_origin_idx" on "qa_TestSuiteTestCaseAssociation"(origin);
create index "qa_TestSuiteTestCaseAssociation_testSuite_idx" on "qa_TestSuiteTestCaseAssociation"("testSuite");
create index "qa_TestSuiteTestCaseAssociation_testCase_idx" on "qa_TestSuiteTestCaseAssociation"("testCase");
create index "tms_TaskTestCaseResultAssociation_defect_idx" on "tms_TaskTestCaseResultAssociation"(defect);
create index "tms_TaskTestCaseResultAssociation_testCaseResult_idx" on "tms_TaskTestCaseResultAssociation"("testCaseResult");

-- expansion --
alter table "qa_CodeQuality" add column "bugsValue" text generated always as (bugs ->> 'value') stored;
alter table "qa_CodeQuality" add column "branchCoverageValue" text generated always as ("branchCoverage" ->> 'value') stored;
alter table "qa_CodeQuality" add column "codeSmellsValue" text generated always as ("codeSmells" ->> 'value') stored;
alter table "qa_CodeQuality" add column "complexityValue" text generated always as (complexity ->> 'value') stored;
alter table "qa_CodeQuality" add column "coverageValue" text generated always as (coverage ->> 'value') stored;
alter table "qa_CodeQuality" add column "duplicationsValue" text generated always as (duplications ->> 'value') stored;
alter table "qa_CodeQuality" add column "duplicatedBlocksValue" text generated always as ("duplicatedBlocks" ->> 'value') stored;
alter table "qa_CodeQuality" add column "lineCoverageValue" text generated always as ("lineCoverage" ->> 'value') stored;
alter table "qa_CodeQuality" add column "securityHotspotsValue" text generated always as ("securityHotspots" ->> 'value') stored;
alter table "qa_CodeQuality" add column "vulnerabilitiesValue" text generated always as (vulnerabilities ->> 'value') stored;
alter table "qa_TestCase" add column "beforeDescription" text generated always as (before ->> 'description') stored;
alter table "qa_TestCase" add column "beforeCondition" text generated always as (before ->> 'condition') stored;
alter table "qa_TestCase" add column "afterDescription" text generated always as (after ->> 'description') stored;
alter table "qa_TestCase" add column "afterCondition" text generated always as (after ->> 'condition') stored;
alter table "qa_TestCase" add column "typeCategory" text generated always as (type ->> 'category') stored;
alter table "qa_TestCase" add column "typeDetail" text generated always as (type ->> 'detail') stored;
alter table "qa_TestCaseResult" add column "statusCategory" text generated always as (status ->> 'category') stored;
alter table "qa_TestCaseResult" add column "statusDetail" text generated always as (status ->> 'detail') stored;
alter table "qa_TestCaseStepResult" add column "statusCategory" text generated always as (status ->> 'category') stored;
alter table "qa_TestCaseStepResult" add column "statusDetail" text generated always as (status ->> 'detail') stored;
alter table "qa_TestExecution" add column "statusCategory" text generated always as (status ->> 'category') stored;
alter table "qa_TestExecution" add column "statusDetail" text generated always as (status ->> 'detail') stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsFailure" integer generated always as (("testCaseResultsStats" -> 'failure')::integer) stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsSuccess" integer generated always as (("testCaseResultsStats" -> 'success')::integer) stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsSkipped" integer generated always as (("testCaseResultsStats" -> 'skipped')::integer) stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsUnknown" integer generated always as (("testCaseResultsStats" -> 'unknown')::integer) stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsCustom" integer generated always as (("testCaseResultsStats" -> 'custom')::integer) stored;
alter table "qa_TestExecution" add column "testCaseResultsStatsTotal" integer generated always as (("testCaseResultsStats" -> 'total')::integer) stored;
alter table "qa_TestExecution" add column "deviceInfoName" text generated always as ("deviceInfo" -> 'name') stored;
alter table "qa_TestExecution" add column "deviceInfoOs" text generated always as ("deviceInfo" -> 'os') stored;
alter table "qa_TestExecution" add column "deviceInfoBrowser" text generated always as ("deviceInfo" -> 'browser') stored;
alter table "qa_TestExecution" add column "deviceInfoType" text generated always as ("deviceInfo" -> 'type') stored;
alter table "qa_TestSuite" add column "typeCategory" text generated always as (type ->> 'category') stored;
alter table "qa_TestSuite" add column "typeDetail" text generated always as (type ->> 'detail') stored;

comment on column "qa_CodeQuality"."bugsValue" is 'generated';
comment on column "qa_CodeQuality"."branchCoverageValue" is 'generated';
comment on column "qa_CodeQuality"."codeSmellsValue" is 'generated';
comment on column "qa_CodeQuality"."complexityValue" is 'generated';
comment on column "qa_CodeQuality"."coverageValue" is 'generated';
comment on column "qa_CodeQuality"."duplicationsValue" is 'generated';
comment on column "qa_CodeQuality"."duplicatedBlocksValue" is 'generated';
comment on column "qa_CodeQuality"."lineCoverageValue" is 'generated';
comment on column "qa_CodeQuality"."securityHotspotsValue" is 'generated';
comment on column "qa_CodeQuality"."vulnerabilitiesValue" is 'generated';
comment on column "qa_TestCase"."typeCategory" is 'generated';
comment on column "qa_TestCase"."typeDetail" is 'generated';
comment on column "qa_TestCaseResult"."statusCategory" is 'generated';
comment on column "qa_TestCaseResult"."statusDetail" is 'generated';
comment on column "qa_TestCaseStepResult"."statusCategory" is 'generated';
comment on column "qa_TestCaseStepResult"."statusDetail" is 'generated';
comment on column "qa_TestExecution"."statusCategory" is 'generated';
comment on column "qa_TestExecution"."statusDetail" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsFailure" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsSuccess" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsSkipped" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsUnknown" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsCustom" is 'generated';
comment on column "qa_TestExecution"."testCaseResultsStatsTotal" is 'generated';
comment on column "qa_TestExecution"."deviceInfoName" is 'generated';
comment on column "qa_TestExecution"."deviceInfoOs" is 'generated';
comment on column "qa_TestExecution"."deviceInfoBrowser" is 'generated';
comment on column "qa_TestExecution"."deviceInfoType" is 'generated';
comment on column "qa_TestSuite"."typeCategory" is 'generated';
comment on column "qa_TestSuite"."typeDetail" is 'generated';
