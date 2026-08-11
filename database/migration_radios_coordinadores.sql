ALTER TABLE users MODIFY role ENUM('admin','supervisor','coordinator') NOT NULL DEFAULT 'supervisor';

CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, work_date DATE NOT NULL,
  turno ENUM('dia','noche') NOT NULL, funcion_1 VARCHAR(150) NULL, funcion_2 VARCHAR(150) NULL,
  zona_1 VARCHAR(150) NULL, puesto VARCHAR(150) NULL, nave VARCHAR(150) NULL, nave_2 VARCHAR(150) NULL,
  imported_by INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supervisor_assignment (user_id, work_date, turno),
  CONSTRAINT fk_supervisor_assignment_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_supervisor_assignment_importer FOREIGN KEY (imported_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radio_traceability (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, work_date DATE NOT NULL,
  turno ENUM('dia','noche') NOT NULL, radio_code VARCHAR(100) NOT NULL, notes VARCHAR(500) NULL,
  registered_by INT NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_radio_traceability (user_id, work_date, turno),
  CONSTRAINT fk_radio_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_radio_registered_by FOREIGN KEY (registered_by) REFERENCES users(id)
) ENGINE=InnoDB;
