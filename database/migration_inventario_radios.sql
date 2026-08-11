CREATE TABLE IF NOT EXISTS radios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  imei VARCHAR(80) NOT NULL UNIQUE,
  model VARCHAR(120) NOT NULL,
  location VARCHAR(150) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radio_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  radio_id INT NOT NULL,
  supervisor_id INT NOT NULL,
  work_date DATE NOT NULL,
  turno ENUM('dia','noche') NOT NULL,
  nave VARCHAR(150) NULL,
  location VARCHAR(150) NULL,
  condition_status ENUM('Pantalla Rota','Excelente Estado','Botones Dañados') NOT NULL,
  comments VARCHAR(1000) NULL,
  photo_path VARCHAR(255) NULL,
  registered_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_radio_assignment_radio FOREIGN KEY (radio_id) REFERENCES radios(id),
  CONSTRAINT fk_radio_assignment_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id),
  CONSTRAINT fk_radio_assignment_registered_by FOREIGN KEY (registered_by) REFERENCES users(id),
  INDEX idx_radio_assignment_shift (work_date, turno),
  INDEX idx_radio_assignment_radio (radio_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radio_assignment_collaborators (
  radio_assignment_id INT NOT NULL,
  opm_id INT NOT NULL,
  PRIMARY KEY (radio_assignment_id, opm_id),
  CONSTRAINT fk_radio_assignment_collaborator_assignment FOREIGN KEY (radio_assignment_id) REFERENCES radio_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_radio_assignment_collaborator_opm FOREIGN KEY (opm_id) REFERENCES opms(id)
) ENGINE=InnoDB;
