-- Create survey_User
create table "survey_User" (
  id text generated always as (pkey(uid, source)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  email text,
  name text,
  source text not null
);
-- Create indexes for survey_user
create index "survey_User_uid_idx" on "survey_User"(uid);
-- Comments for survey_user
comment on column "survey_User".id is 'generated';

-- Create survey_team
create table "survey_Team" (
  id text generated always as (pkey(uid, source)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  name text,
  description text,
  source text not null
);
-- Create indexes for survey_team
create index "survey_Team_uid_idx" on "survey_Team"(uid);
create index "survey_Team_source_idx" on "survey_Team"(source);
-- Comments for survey_team
comment on column "survey_Team".id is 'generated';

-- Create survey_Survey
create table "survey_Survey" (
  id text generated always as (pkey(uid, source)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  name text,
  description text,
  type jsonb,
  status jsonb,
  "startedAt" timestamptz,
  "endedAt" timestamptz,
  creator text,
  stats jsonb,
  source text,
  foreign key ("creator") references "survey_User"(id)
);
-- Add generated columns for questionCount, invitationCount, and responseCount
alter table "survey_Survey" add column "typeCategory" text generated always as ((type->>'category')::text) stored;
alter table "survey_Survey" add column "typeDetail" text generated always as ((type->>'detail')::text) stored;
alter table "survey_Survey" add column "statusCategory" text generated always as ((status->>'category')::text) stored;
alter table "survey_Survey" add column "statusDetail" text generated always as ((status->>'detail')::text) stored;
alter table "survey_Survey" add column "questionCount" int4 generated always as ((stats->>'questionCount')::int4) stored;
alter table "survey_Survey" add column "invitationCount" int4 generated always as ((stats->>'invitationCount')::int4) stored;
alter table "survey_Survey" add column "responseCount" int4 generated always as ((stats->>'responseCount')::int4) stored;
-- Create indexes for survey_Survey
create index "survey_Survey_uid_idx" on "survey_Survey"(uid);
create index "survey_Survey_creator_idx" on "survey_Survey"(creator);
-- Comments for survey_Survey
comment on column "survey_Survey".id is 'generated';
comment on column "survey_Survey"."typeCategory" is 'generated';
comment on column "survey_Survey"."typeDetail" is 'generated';
comment on column "survey_Survey"."statusCategory" is 'generated';
comment on column "survey_Survey"."statusDetail" is 'generated';
comment on column "survey_Survey"."questionCount" is 'generated';
comment on column "survey_Survey"."invitationCount" is 'generated';
comment on column "survey_Survey"."responseCount" is 'generated';

-- Create survey_Question
create table "survey_Question" (
  id text generated always as (pkey(uid, source)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  question text,
  description text,
  "questionCategory" jsonb,
  "responseType" jsonb,
  source text
);
-- Add generated columns for questionCategory and responseType
alter table "survey_Question" add column "questionCategoryCategory" text generated always as (("questionCategory"->>'category')::text) stored;
alter table "survey_Question" add column "questionCategoryDetail" text generated always as (("questionCategory"->>'detail')::text) stored;
alter table "survey_Question" add column "responseTypeCategory" text generated always as (("responseType"->>'category')::text) stored;
alter table "survey_Question" add column "responseTypeDetail" text generated always as (("responseType"->>'detail')::text) stored;
-- Create indexes for survey_question
create index "survey_Question_uid_idx" on "survey_Question"(uid);
-- Comments for survey_question
comment on column "survey_Question".id is 'generated';
comment on column "survey_Question"."questionCategoryCategory" is 'generated';
comment on column "survey_Question"."questionCategoryDetail" is 'generated';
comment on column "survey_Question"."responseTypeCategory" is 'generated';
comment on column "survey_Question"."responseTypeDetail" is 'generated';

-- Create survey_SurveyQuestionAssociation
create table "survey_SurveyQuestionAssociation" (
  id text generated always as (pkey(survey, question)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  survey text not null,
  question text not null,
  "order" integer,
  foreign key (survey) references "survey_Survey"(id),
  foreign key (question) references "survey_Question"(id)
);
-- Create indexes for survey_surveyquestionassociation
create index "survey_SurveyQuestionAssociation_survey_idx" on "survey_SurveyQuestionAssociation"(survey);
create index "survey_SurveyQuestionAssociation_question_idx" on "survey_SurveyQuestionAssociation"(question);
-- Comments for survey_surveyquestionassociation
comment on column "survey_SurveyQuestionAssociation".id is 'generated';

-- Create survey_QuestionResponse
create table "survey_QuestionResponse" (
  id text generated always as (pkey(uid, "surveyQuestion")) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  "submittedAt" timestamptz,
  response text,
  "surveyQuestion" text not null,
  respondent text,
  team text,
  foreign key ("surveyQuestion") references "survey_SurveyQuestionAssociation"(id),
  foreign key (respondent) references "survey_User"(id),
  foreign key (team) references "survey_Team"(id)
);
-- Create indexes for survey_questionresponse
create index "survey_QuestionResponse_uid_idx" on "survey_QuestionResponse"(uid);
create index "survey_QuestionResponse_surveyquestion_idx" on "survey_QuestionResponse"("surveyQuestion");
create index "survey_QuestionResponse_respondent_idx" on "survey_QuestionResponse"(respondent);
create index "survey_QuestionResponse_team_idx" on "survey_QuestionResponse"(team);
-- Comments for survey_questionresponse
comment on column "survey_QuestionResponse".id is 'generated';
