create table "ims_Alert" (
  id text generated always as (pkey(source, uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  title text,
  alertsouce text,
  alertOwner text,
  priority jsonb,
  status jsonb,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "lastOccurredAt" timestamptz,
  source text
);

create table "ims_AlertAssignment" (
  id text generated always as (pkey(alert, assignee)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  assignee text,
  alert text
);

create table "ims_AlertTag" (
  id text generated always as (pkey(alert, label)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  alert text,
  label text
);

create table "ims_AlertIntegrationAssociation" (
  id text generated always as (pkey(alert, uid)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  uid text not null,
  type jsonb,
  "createdAt" timestamptz,
  detail text,
  alert text
);

create table "ims_AlertReportAssociation" (
  id text generated always as (pkey(alert, detail)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  report jsonb,
  "createdAt" timestamptz,
  detail text,
  alert text
);

create table "ims_AlertSourceAssociation" (
  id text generated always as (pkey(alert, source)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  source text,
  alert text
);

create table "ims_TeamAlertAssociation" (
  id text generated always as (pkey(alert, team)) stored primary key,
  origin text,
  "refreshedAt" timestamptz not null default now(),
  alert text,
  team text
);
