
/*
# Add preview_region binding + security note

1. Changes
   - Add `preview_region` (text, nullable) to `layers`. This is a stable,
     id-based binding from a layer to a region of the card preview, so
     renaming a layer no longer breaks the preview link.

2. Security note (IMPORTANT)
   The RLS policies created in migration 001 grant every anon/authenticated
   client full CRUD on ALL rows (USING/WITH CHECK = true). That is acceptable
   for a single-user demo/prototype ONLY. For production / multi-tenant use,
   introduce a `projects` table (id, owner_id, name, created_at) plus a
   `layers.project_id` column, and scope each policy to the project owner or a
   collaborator, e.g.:

     USING (
       project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
     )

   The policies are intentionally left permissive here to keep the demo
   working without auth.
*/

ALTER TABLE layers
  ADD COLUMN IF NOT EXISTS preview_region text;
