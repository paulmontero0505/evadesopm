ALTER TABLE radio_assignments
  ADD COLUMN delivery_group VARCHAR(40) NULL AFTER id,
  ADD INDEX idx_radio_assignment_group (delivery_group);
