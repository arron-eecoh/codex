-- The Steward's Codex — user data table + Row Level Security
-- Run once in Supabase: SQL Editor → New query → paste → Run.

create table if not exists public.codex_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.codex_states enable row level security;

drop policy if exists "own state select" on public.codex_states;
drop policy if exists "own state insert" on public.codex_states;
drop policy if exists "own state update" on public.codex_states;

create policy "own state select" on public.codex_states for select using (auth.uid() = user_id);
create policy "own state insert" on public.codex_states for insert with check (auth.uid() = user_id);
create policy "own state update" on public.codex_states for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
