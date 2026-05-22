-- ── SwiftStake: Audit Log Table ──
-- Run this in the Supabase SQL Editor once.

create table if not exists public.audit_log (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  actor_name  text,
  shop        text,
  section     text,
  action      text,        -- push | submit | edit | add | remove | delete
  before_val  text,        -- human-readable snapshot before change
  after_val   text         -- human-readable snapshot after change
);

-- Index for the most common queries (by shop, by actor, by time)
create index if not exists audit_log_ts_idx     on public.audit_log (ts desc);
create index if not exists audit_log_shop_idx   on public.audit_log (shop);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_name);

-- Row-Level Security: allow insert from anon (cashier/admin both write)
alter table public.audit_log enable row level security;

create policy "Allow insert" on public.audit_log
  for insert to anon with check (true);

create policy "Allow select" on public.audit_log
  for select to anon using (true);

-- Optional: auto-purge entries older than 90 days (uncomment if desired)
-- create extension if not exists pg_cron;
-- select cron.schedule('purge-audit-log', '0 3 * * *',
--   $$delete from public.audit_log where ts < now() - interval '90 days'$$);
