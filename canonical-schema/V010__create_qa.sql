-- qa models --
create table
  "qa_CodeQuality"(
    id text generated always as(pkey("uid":: text)) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "bugs" jsonb,
    "branchCoverage" jsonb,
    "codeSmells" jsonb,
    "complexity" jsonb,
    "coverage" jsonb,
    "duplications" jsonb,
    "duplicatedBlocks" jsonb,
    "lineCoverage" jsonb,
    "securityHotspots" jsonb,
    "vulnerabilities" jsonb,
    "createdAt" timestamptz,
    "pullRequest" text,
    "repository" text
  );
create table
  "qa_TestCase"(
    id text generated always as(
      pkey("source":: text, "uid":: text)
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "name" text,
    "description" text,
    "source" text,
    "before" jsonb,
    "after" jsonb,
    "tags" jsonb,
    "type" jsonb,
    "task" text
  );
create table
  "qa_TestCaseResult"(
    id text generated always as(
      pkey(
        "testExecution":: text,
        "uid":: text
      )
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "description" text,
    "startedAt" timestamptz,
    "endedAt" timestamptz,
    "status" jsonb,
    "testCase" text,
    "testExecution" text
  );
create table
  "qa_TestCaseStep"(
    id text generated always as(
      pkey(
        "testCase":: text,
        "uid":: text
      )
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "name" text,
    "description" text,
    "data" text,
    "result" text,
    "testCase" text
  );
create table
  "qa_TestCaseStepResult"(
    id text generated always as(
      pkey(
        "testResult":: text,
        "uid":: text
      )
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "status" jsonb,
    "testStep" text,
    "testResult" text
  );
create table
  "qa_TestExecution"(
    id text generated always as(
      pkey("source":: text, "uid":: text)
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "name" text,
    "description" text,
    "source" text,
    "startedAt" timestamptz,
    "endedAt" timestamptz,
    "status" jsonb,
    "environments" jsonb,
    "testCaseResultsStats" jsonb,
    "deviceInfo" jsonb,
    "tags" jsonb,
    "suite" text,
    "task" text,
    "build" text
  );
create table
  "qa_TestExecutionCommitAssociation"(
    id text generated always as(
      pkey(
        "commit":: text,
        "testExecution":: text
      )
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "testExecution" text,
    "commit" text
  );
create table
  "qa_TestSuite"(
    id text generated always as(
      pkey("source":: text, "uid":: text)
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "uid" text not null,
    "name" text,
    "description" text,
    "source" text,
    "tags" jsonb,
    "type" jsonb,
    "task" text
  );
create table
  "qa_TestSuiteTestCaseAssociation"(
    id text generated always as(
      pkey(
        "testCase":: text,
        "testSuite":: text
      )
    ) stored primary key,
    origin text,
    "refreshedAt" timestamptz not null default now(),
    "testSuite" text,
    "testCase" text
  );

-- foreign keys --
alter table "qa_CodeQuality" add foreign key ("pullRequest") references "vcs_PullRequest"(id);
alter table "qa_CodeQuality" add foreign key ("repository") references "vcs_Repository"(id);
alter table "qa_TestCase" add foreign key ("task") references "tms_Task"(id);
alter table "qa_TestCaseResult" add foreign key ("testCase") references "qa_TestCase"(id);
alter table "qa_TestCaseResult" add foreign key ("testExecution") references "qa_TestExecution"(id);
alter table "qa_TestCaseStep" add foreign key ("testCase") references "qa_TestCase"(id);
alter table "qa_TestCaseStepResult" add foreign key ("testStep") references "qa_TestCaseStep"(id);
alter table "qa_TestCaseStepResult" add foreign key ("testResult") references "qa_TestCaseResult"(id);
alter table "qa_TestExecution" add foreign key ("suite") references "qa_TestSuite"(id);
alter table "qa_TestExecution" add foreign key ("task") references "tms_Task"(id);
alter table "qa_TestExecution" add foreign key ("build") references "cicd_Build"(id);
alter table "qa_TestExecutionCommitAssociation" add foreign key ("testExecution") references "qa_TestExecution"(id);
alter table "qa_TestExecutionCommitAssociation" add foreign key ("commit") references "vcs_Commit"(id);
alter table "qa_TestSuite" add foreign key ("task") references "tms_Task"(id);
alter table "qa_TestSuiteTestCaseAssociation" add foreign key ("testSuite") references "qa_TestSuite"(id);
alter table "qa_TestSuiteTestCaseAssociation" add foreign key ("testCase") references "qa_TestCase"(id);

-- indices --
create index "qa_CodeQuality_origin_idx" on "qa_CodeQuality"("origin");
create index "qa_CodeQuality_uid_idx" on "qa_CodeQuality"("uid");
create index "qa_CodeQuality_createdAt_idx" on "qa_CodeQuality"("createdAt");
create index "qa_CodeQuality_pull_request_idx" on "qa_CodeQuality"("pullRequest");
create index "qa_CodeQuality_repository_idx" on "qa_CodeQuality"("repository");
create index "qa_TestCase_origin_idx" on "qa_TestCase"("origin");
create index "qa_TestCase_uid_idx" on "qa_TestCase"("uid");
create index "qa_TestCase_task_idx" on "qa_TestCase"("task");
create index "qa_TestCaseResult_origin_idx" on "qa_TestCaseResult"("origin");
create index "qa_TestCaseResult_uid_idx" on "qa_TestCaseResult"("uid");
create index "qa_TestCaseResult_startedAt_idx" on "qa_TestCaseResult"("startedAt");
create index "qa_TestCaseResult_endedAt_idx" on "qa_TestCaseResult"("endedAt");
create index "qa_TestCaseResult_testCase_idx" on "qa_TestCaseResult"("testCase");
create index "qa_TestCaseResult_testExecution_idx" on "qa_TestCaseResult"("testExecution");
create index "qa_TestCaseStep_origin_idx" on "qa_TestCaseStep"("origin");
create index "qa_TestCaseStep_uid_idx" on "qa_TestCaseStep"("uid");
create index "qa_TestCaseStep_testCase_idx" on "qa_TestCaseStep"("testCase");
create index "qa_TestCaseStepResult_origin_idx" on "qa_TestCaseStepResult"("origin");
create index "qa_TestCaseStepResult_uid_idx" on "qa_TestCaseStepResult"("uid");
create index "qa_TestCaseStepResult_testStep_idx" on "qa_TestCaseStepResult"("testStep");
create index "qa_TestCaseStepResult_testResult_idx" on "qa_TestCaseStepResult"("testResult");
create index "qa_TestExecution_origin_idx" on "qa_TestExecution"("origin");
create index "qa_TestExecution_uid_idx" on "qa_TestExecution"("uid");
create index "qa_TestExecution_startedAt_idx" on "qa_TestExecution"("startedAt");
create index "qa_TestExecution_endedAt_idx" on "qa_TestExecution"("endedAt");
create index "qa_TestExecution_suite_idx" on "qa_TestExecution"("suite");
create index "qa_TestExecution_task_idx" on "qa_TestExecution"("task");
create index "qa_TestExecution_build_idx" on "qa_TestExecution"("build");
create index "qa_TestExecutionCommitAssociation_origin_idx" on "qa_TestExecutionCommitAssociation"("origin");
create index "qa_TestExecutionCommitAssociation_testExecution_idx" on "qa_TestExecutionCommitAssociation"("testExecution");
create index "qa_TestExecutionCommitAssociation_commit_idx" on "qa_TestExecutionCommitAssociation"("commit");
create index "qa_TestSuite_origin_idx" on "qa_TestSuite"("origin");
create index "qa_TestSuite_uid_idx" on "qa_TestSuite"("uid");
create index "qa_TestSuite_task_idx" on "qa_TestSuite"("task");
create index "qa_TestSuiteTestCaseAssociation_origin_idx" on "qa_TestSuiteTestCaseAssociation"("origin");
create index "qa_TestSuiteTestCaseAssociation_testSuite_idx" on "qa_TestSuiteTestCaseAssociation"("testSuite");
create index "qa_TestSuiteTestCaseAssociation_testCase_idx" on "qa_TestSuiteTestCaseAssociation"("testCase");
