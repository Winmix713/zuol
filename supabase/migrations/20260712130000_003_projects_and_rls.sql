-- ============================================================
-- Migration: projects table + project_id on layers + RLS
-- ============================================================
-- Run this against your Supabase project via the SQL editor or
-- the Supabase CLI: supabase db push
-- ============================================================

-- 1. Projects table -------------------------------------------------

create table if not exists projects (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null default 'Untitled Project',
  owner_id    uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table projects is
  'Top-level project containers. Each project owns a set of layer rows.';

-- Keep updated_at current automatically.
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- 2. Add project_id + updated_at to layers -------------------------

alter table layers
  add column if not exists project_id uuid
    references projects(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

-- Index so project-scoped queries stay fast.
create index if not exists idx_layers_project_id
  on layers(project_id);

drop trigger if exists trg_layers_updated_at on layers;
create trigger trg_layers_updated_at
  before update on layers
  for each row execute function update_updated_at();

-- 3. Row-Level Security --------------------------------------------
-- NOTE: These policies assume anonymous/authenticated access via
-- the Supabase anon key.  For multi-user production you would
-- replace these with owner_id-scoped policies (see comments below).

alter table projects enable row level security;
alter table layers   enable row level security;

-- ── Anonymous / single-user policies (current default) ────────────
-- Allow the anon key to read/write any project. Fine for a single-
-- developer or demo setup. Replace with the authenticated policies
-- below once you add Supabase Auth.

drop policy if exists "anon can manage projects" on projects;
create policy "anon can manage projects"
  on projects for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon can manage layers" on layers;
create policy "anon can manage layers"
  on layers for all
  to anon, authenticated
  using (true)
  with check (true);

-- ── Owner-scoped policies (enable once Auth is added) ─────────────
-- Uncomment these and delete the anon policies above when you are
-- ready to enforce per-user access control.

/*
drop policy if exists "owners can manage their projects" on projects;
create policy "owners can manage their projects"
  on projects for all
  to authenticated
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owners can manage their layers" on layers;
create policy "owners can manage their layers"
  on layers for all
  to authenticated
  using (
    exists (
      select 1 from projects p
      where p.id = layers.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = layers.project_id
        and p.owner_id = auth.uid()
    )
  );
*/

-- 4. Cross-project parent_id integrity --------------------------------
-- Ensures a layer's parent_id always belongs to the same project.
-- We create a composite unique key on (project_id, id) first, then
-- reference it from (project_id, parent_id).  The parent_id column
-- must be nullable (root layers have no parent).
--
-- NOTE: This requires that every layer row has project_id set.
-- The seed block below handles any NULL project_id rows first.

-- Composite unique index: (project_id, id) — needed as FK target.
-- Use IF NOT EXISTS guard so re-runs are safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'layers_project_id_id_key'
  ) then
    alter table layers
      add constraint layers_project_id_id_key unique (project_id, id);
  end if;
end;
$$;

-- Composite FK: (project_id, parent_id) → (project_id, id).
-- This prevents cross-project parent references.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'layers_parent_same_project_fk'
  ) then
    alter table layers
      add constraint layers_parent_same_project_fk
        foreign key (project_id, parent_id)
        references layers (project_id, id)
        on delete cascade
        deferrable initially deferred;
  end if;
end;
$$;

-- 5. Seed existing layers into a default project -------------------
-- If you have rows in `layers` with a NULL project_id from before
-- this migration, this block assigns them to a shared default project
-- so the app can still query them.

do $$
declare
  _default_project_id uuid;
begin
  -- Only run if there are orphaned rows.
  if exists (select 1 from layers where project_id is null) then
    insert into projects (name)
    values ('Default Project')
    returning id into _default_project_id;

    update layers
       set project_id = _default_project_id
     where project_id is null;

    raise notice 'Assigned orphaned layers to project %', _default_project_id;
  end if;
end;
$$;
