ALTER TABLE radio_assignments
  ADD COLUMN current_supervisor_id INT NULL AFTER supervisor_id,
  ADD COLUMN current_work_date DATE NULL AFTER work_date,
  ADD COLUMN current_turno ENUM('dia','noche') NULL AFTER turno,
  ADD CONSTRAINT fk_radio_assignment_current_supervisor FOREIGN KEY (current_supervisor_id) REFERENCES users(id),
  ADD INDEX idx_radio_assignment_custody (current_work_date, current_turno, current_supervisor_id);

UPDATE radio_assignments
SET current_supervisor_id = supervisor_id,
    current_work_date = work_date,
    current_turno = turno
WHERE returned_at IS NULL AND current_supervisor_id IS NULL;

CREATE TABLE IF NOT EXISTS radio_assignment_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  radio_assignment_id INT NOT NULL,
  action ENUM('return','reassign') NOT NULL,
  from_user_id INT NOT NULL,
  to_user_id INT NULL,
  work_date DATE NOT NULL,
  turno ENUM('dia','noche') NOT NULL,
  comments VARCHAR(1000) NULL,
  photo_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_radio_movement_assignment FOREIGN KEY (radio_assignment_id) REFERENCES radio_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_radio_movement_from FOREIGN KEY (from_user_id) REFERENCES users(id),
  CONSTRAINT fk_radio_movement_to FOREIGN KEY (to_user_id) REFERENCES users(id),
  INDEX idx_radio_movement_assignment (radio_assignment_id)
) ENGINE=InnoDB;
