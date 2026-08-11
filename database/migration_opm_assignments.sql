-- Ejecutar una vez en instalaciones que ya tienen la base de datos creada.
CREATE TABLE IF NOT EXISTS opm_assignments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  opm_id      INT NOT NULL,
  work_date   DATE NOT NULL,
  turno       ENUM('dia','noche') NOT NULL,
  funcion_1   VARCHAR(150) NULL,
  funcion_2   VARCHAR(150) NULL,
  zona_1      VARCHAR(150) NULL,
  zona_2      VARCHAR(150) NULL,
  puesto      VARCHAR(150) NULL,
  nave        VARCHAR(150) NULL,
  nave_2      VARCHAR(150) NULL,
  imported_by INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_opm_assignment (opm_id, work_date, turno),
  INDEX idx_assignment_turno (work_date, turno),
  CONSTRAINT fk_assignment_opm FOREIGN KEY (opm_id) REFERENCES opms(id),
  CONSTRAINT fk_assignment_user FOREIGN KEY (imported_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- Para instalaciones donde la tabla ya existía antes de añadir NAVE 2:
SET @nave_2_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opm_assignments' AND COLUMN_NAME = 'nave_2'
);
SET @add_nave_2 = IF(@nave_2_exists = 0,
  'ALTER TABLE opm_assignments ADD COLUMN nave_2 VARCHAR(150) NULL AFTER nave',
  'SELECT 1');
PREPARE add_nave_2 FROM @add_nave_2;
EXECUTE add_nave_2;
DEALLOCATE PREPARE add_nave_2;
