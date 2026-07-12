/*
# Create layers table

1. New Tables
- `layers`
- `id` (uuid, primary key)
- `name` (text, not null)
- `type` (text, not null) - one of: FRAME, GROUP, SHAPE, TEXT
- `color` (text, not null)
- `parent_id` (uuid, nullable) - references another layer for tree structure
- `order` (integer, default 0) - sort order among siblings
- `visible` (boolean, default true) - layer visibility toggle
- `locked` (boolean, default false) - layer lock toggle
- `opacity` (numeric, default 100) - opacity percentage 0-100
- `blend_mode` (text, default 'normal') - blend mode for compositing
- `label_color` (text, nullable) - color coding label
- `tags` (text array, default empty) - array of tag strings
- `created_at` (timestamp)
- `updated_at` (timestamp)

2. Security
- Enable RLS on `layers`.
- Single-tenant app with no auth - allow anon + authenticated full CRUD access.
*/

CREATE TABLE IF NOT EXISTS layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  color text NOT NULL,
  parent_id uuid REFERENCES layers(id) ON DELETE CASCADE,
  "order" integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  opacity numeric NOT NULL DEFAULT 100 CHECK (opacity >= 0 AND opacity <= 100),
  blend_mode text NOT NULL DEFAULT 'normal',
  label_color text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE layers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_layers" ON layers;
CREATE POLICY "anon_select_layers" ON layers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_layers" ON layers;
CREATE POLICY "anon_insert_layers" ON layers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_layers" ON layers;
CREATE POLICY "anon_update_layers" ON layers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_layers" ON layers;
CREATE POLICY "anon_delete_layers" ON layers FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_layers_parent_id ON layers(parent_id);
CREATE INDEX IF NOT EXISTS idx_layers_order ON layers("order");