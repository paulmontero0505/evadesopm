ALTER TABLE radio_assignment_movements
  MODIFY COLUMN action ENUM('return','reassign','relocate') NOT NULL;
