ALTER TABLE radio_assignments
  ADD COLUMN assigned_puesto VARCHAR(150) NULL AFTER location,
  ADD COLUMN returned_at DATETIME NULL AFTER photo_path,
  ADD COLUMN returned_by INT NULL AFTER returned_at,
  ADD COLUMN return_comments VARCHAR(1000) NULL AFTER returned_by,
  ADD COLUMN return_photo_path VARCHAR(255) NULL AFTER return_comments,
  ADD CONSTRAINT fk_radio_assignment_returned_by FOREIGN KEY (returned_by) REFERENCES users(id);
