drop index "vcs_Commit_message_idx";
create index "vcs_Commit_message_idx" on "vcs_Commit" USING hash(message);
