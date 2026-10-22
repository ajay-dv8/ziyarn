-- Row counts for the core tables.
--
-- Run against both the source database and a restore branch:
--   psql "$DATABASE_URL" -f scripts/check-restore-counts.sql
--   psql "$RESTORE_DATABASE_URL" -f scripts/check-restore-counts.sql
--
-- For an exact comparison, use a fresh dump taken immediately before the
-- restore. A weekly artifact will naturally drift for append-only tables such
-- as messages, conversations, leads, and payments.
--
-- `user` is Better Auth's account table; `users` is the app-level profile
-- table. Both are included because a restore that loses either one is broken.

\set ON_ERROR_STOP on

select table_name, row_count
from (
  select 'agents' as table_name, count(*) as row_count from agents
  union all
  select 'campaigns' as table_name, count(*) as row_count from campaigns
  union all
  select 'conversations' as table_name, count(*) as row_count from conversations
  union all
  select 'domains' as table_name, count(*) as row_count from domains
  union all
  select 'leads' as table_name, count(*) as row_count from leads
  union all
  select 'messages' as table_name, count(*) as row_count from messages
  union all
  select 'payments' as table_name, count(*) as row_count from payments
  union all
  select 'subscriptions' as table_name, count(*) as row_count from subscriptions
  union all
  select 'user' as table_name, count(*) as row_count from "user"
  union all
  select 'users' as table_name, count(*) as row_count from users
) as core_counts
order by table_name;
