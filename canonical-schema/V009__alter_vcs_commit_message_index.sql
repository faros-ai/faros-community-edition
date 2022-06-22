drop index "vcs_Commit_message_idx";
create index "vcs_Commit_message_idx" on "vcs_Commit" using gin (to_tsvector('english', message));
