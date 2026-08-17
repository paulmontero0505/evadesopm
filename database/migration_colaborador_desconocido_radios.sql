ALTER TABLE radio_assignments
  ADD COLUMN collaborator_unknown TINYINT(1) NOT NULL DEFAULT 0 AFTER assigned_puesto;
