-- ============================================================
--  Sistema de Desempeño OPM (COSCO SHIPPING Ports Chancay)
--  Motor: MariaDB 10.4 / MySQL 8
-- ============================================================

CREATE DATABASE IF NOT EXISTS evadesopm
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evadesopm;

-- ---------- Usuarios del sistema (admin / supervisor) ----------
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  employee_number VARCHAR(20)  NOT NULL UNIQUE,
  full_name       VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin','supervisor','coordinator','labor') NOT NULL DEFAULT 'supervisor',
  active          TINYINT(1)   NOT NULL DEFAULT 1,
  -- Se activa cuando administración asigna la clave de un supervisor.
  -- El supervisor puede definir su propia clave en el siguiente inicio de sesión.
  password_change_required TINYINT(1) NOT NULL DEFAULT 0,
  code            VARCHAR(20)  NULL,   -- COD del colaborador (plantilla de supervisores)
  dni             VARCHAR(20)  NULL,
  fecha_ingreso   DATE         NULL,
  puesto          VARCHAR(150) NULL,
  team            VARCHAR(100) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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

-- ---------- Tokens de sesión ----------
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Catálogo de OPM (operarios evaluados, no inician sesión) ----------
CREATE TABLE IF NOT EXISTS opms (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(20)  NOT NULL UNIQUE,   -- OPM-001
  full_name      VARCHAR(120) NOT NULL,
  dni            VARCHAR(20)  NULL,
  fecha_ingreso  DATE         NULL,
  fecha_nacimiento DATE       NULL,
  telefono       VARCHAR(30)  NULL,
  email_personal VARCHAR(150) NULL,
  puesto         VARCHAR(150) NULL,
  team           VARCHAR(100) NULL,
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Inventario de radios y entregas por turno ----------
CREATE TABLE IF NOT EXISTS radios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  imei VARCHAR(80) NOT NULL UNIQUE,
  model VARCHAR(120) NOT NULL,
  location VARCHAR(150) NULL,
  condition_status ENUM('Pantalla Rota','Excelente Estado','Botones Dañados') NOT NULL DEFAULT 'Excelente Estado',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radio_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_group VARCHAR(40) NULL,
  radio_id INT NOT NULL,
  supervisor_id INT NOT NULL,
  current_supervisor_id INT NULL,
  work_date DATE NOT NULL,
  current_work_date DATE NULL,
  turno ENUM('dia','noche') NOT NULL,
  current_turno ENUM('dia','noche') NULL,
  nave VARCHAR(150) NULL,
  location VARCHAR(150) NULL,
  assigned_puesto VARCHAR(150) NULL,
  condition_status ENUM('Pantalla Rota','Excelente Estado','Botones Dañados') NOT NULL,
  comments VARCHAR(1000) NULL,
  photo_path VARCHAR(255) NULL,
  returned_at DATETIME NULL,
  returned_by INT NULL,
  return_comments VARCHAR(1000) NULL,
  return_photo_path VARCHAR(255) NULL,
  registered_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_radio_assignment_radio FOREIGN KEY (radio_id) REFERENCES radios(id),
  CONSTRAINT fk_radio_assignment_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id),
  CONSTRAINT fk_radio_assignment_current_supervisor FOREIGN KEY (current_supervisor_id) REFERENCES users(id),
  CONSTRAINT fk_radio_assignment_registered_by FOREIGN KEY (registered_by) REFERENCES users(id),
  CONSTRAINT fk_radio_assignment_returned_by FOREIGN KEY (returned_by) REFERENCES users(id),
  INDEX idx_radio_assignment_shift (work_date, turno),
  INDEX idx_radio_assignment_group (delivery_group),
  INDEX idx_radio_assignment_radio (radio_id)
  ,INDEX idx_radio_assignment_custody (current_work_date, current_turno, current_supervisor_id)
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS radio_assignment_collaborators (
  radio_assignment_id INT NOT NULL,
  opm_id INT NOT NULL,
  PRIMARY KEY (radio_assignment_id, opm_id),
  CONSTRAINT fk_radio_assignment_collaborator_assignment FOREIGN KEY (radio_assignment_id) REFERENCES radio_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_radio_assignment_collaborator_opm FOREIGN KEY (opm_id) REFERENCES opms(id)
) ENGINE=InnoDB;

-- ---------- Asignación operativa de OPM por fecha y turno ----------
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

-- ---------- Fichas de turno ----------
CREATE TABLE IF NOT EXISTS shift_records (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  opm_id           INT NOT NULL,
  supervisor_id    INT NOT NULL,                 -- quien calificó
  work_date        DATE NOT NULL,
  year             SMALLINT NOT NULL,             -- derivado de work_date
  quarter          TINYINT  NOT NULL,             -- 1-4, derivado de work_date
  turno            ENUM('dia','noche') NOT NULL,
  carga            ENUM('Contenedores','Granel sólido','Carga fraccionada','Big bags') NOT NULL,
  nave             VARCHAR(150) NULL,               -- nombre de la nave / operación (opcional)
  amarre           TINYINT(1) NOT NULL DEFAULT 0,
  evento_seguridad TINYINT(1) NOT NULL DEFAULT 0,
  evento_comment   VARCHAR(500) NULL,              -- comentario opcional del evento de seguridad
  evento_photo     VARCHAR(255) NULL,               -- ruta relativa a la foto opcional del evento
  -- Promedios por objetivo de ESTA ficha (1-5), ya con el tope por evento aplicado.
  obj_o1 DECIMAL(3,2) NULL,
  obj_o2 DECIMAL(3,2) NULL,
  obj_o3 DECIMAL(3,2) NULL,
  obj_o4 DECIMAL(3,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shift_opm        FOREIGN KEY (opm_id)        REFERENCES opms(id),
  CONSTRAINT fk_shift_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id),
  INDEX idx_shift_opm_period (opm_id, year, quarter),
  INDEX idx_shift_period (year, quarter)
) ENGINE=InnoDB;

-- ---------- Calificación de cada actividad dentro de una ficha ----------
CREATE TABLE IF NOT EXISTS shift_ratings (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  shift_record_id  INT NOT NULL,
  activity_code    VARCHAR(10) NOT NULL,   -- t1, c3, f2, ...
  objective        CHAR(2)     NOT NULL,   -- O1..O4
  rating           TINYINT     NULL,       -- 1-5; NULL = "No aplica" (no promedia)
  comment          VARCHAR(500) NULL,      -- comentario opcional del supervisor
  CONSTRAINT fk_rating_shift FOREIGN KEY (shift_record_id) REFERENCES shift_records(id) ON DELETE CASCADE,
  INDEX idx_rating_shift (shift_record_id)
) ENGINE=InnoDB;

-- ---------- Evaluación trimestral consolidada ----------
CREATE TABLE IF NOT EXISTS evaluations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  opm_id        INT NOT NULL,
  year          SMALLINT NOT NULL,
  quarter       TINYINT  NOT NULL,
  obj_score     DECIMAL(4,2) NULL,   -- 70%: objetivos (1-5)
  cond_score    DECIMAL(4,2) NULL,   -- 30%: conductas (1-5)
  comb_score    DECIMAL(4,2) NULL,   -- combinado (1-5)
  prelim_level  ENUM('Sobre','Cumple','Por Debajo') NULL,
  final_level   ENUM('Sobre','Cumple','Por Debajo') NULL,
  blocked       TINYINT(1) NOT NULL DEFAULT 0,   -- se aplicó regla CSPCP
  n_fichas      INT NOT NULL DEFAULT 0,
  n_supervisors INT NOT NULL DEFAULT 0,
  n_fichas_compromiso      INT NOT NULL DEFAULT 0,
  n_supervisors_compromiso INT NOT NULL DEFAULT 0,
  evidencias_comentarios TEXT NULL,
  evaluated_by  INT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eval_period (opm_id, year, quarter),
  CONSTRAINT fk_eval_opm  FOREIGN KEY (opm_id)       REFERENCES opms(id),
  CONSTRAINT fk_eval_user FOREIGN KEY (evaluated_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------- Conductas corporativas calificadas por evaluación ----------
CREATE TABLE IF NOT EXISTS evaluation_behaviors (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  evaluation_id  INT NOT NULL,
  behavior_key   VARCHAR(60) NOT NULL,
  level          ENUM('Sobre','Cumple','Por Debajo') NOT NULL,
  CONSTRAINT fk_behavior_eval FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_eval_behavior (evaluation_id, behavior_key)
) ENGINE=InnoDB;

-- ---------- Fichas de Evaluación de Compromiso (OPM) ----------
CREATE TABLE IF NOT EXISTS compromiso_records (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  opm_id            INT NOT NULL,
  supervisor_id     INT NOT NULL,                 -- quien calificó
  work_date         DATE NOT NULL,
  year              SMALLINT NOT NULL,             -- derivado de work_date
  quarter           TINYINT  NOT NULL,             -- 1-4, derivado de work_date
  turno             ENUM('dia','noche') NOT NULL,
  conducta_critica  TINYINT(1) NOT NULL DEFAULT 0, -- falta de respeto grave / incumplimiento de consigna
  conducta_comment  VARCHAR(500) NULL,
  conducta_photo    VARCHAR(255) NULL,
  -- Promedios por objetivo de ESTA ficha (1-5), ya con el tope por conducta crítica aplicado.
  obj_o1 DECIMAL(3,2) NULL,
  obj_o2 DECIMAL(3,2) NULL,
  obj_o3 DECIMAL(3,2) NULL,
  obj_o4 DECIMAL(3,2) NULL,
  obj_o5 DECIMAL(3,2) NULL,
  obj_o6 DECIMAL(3,2) NULL,
  obj_o7 DECIMAL(3,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_compromiso_opm        FOREIGN KEY (opm_id)        REFERENCES opms(id),
  CONSTRAINT fk_compromiso_supervisor FOREIGN KEY (supervisor_id) REFERENCES users(id),
  INDEX idx_compromiso_opm_period (opm_id, year, quarter),
  INDEX idx_compromiso_period (year, quarter)
) ENGINE=InnoDB;

-- ---------- Calificación de cada actividad de conducta dentro de una ficha de compromiso ----------
CREATE TABLE IF NOT EXISTS compromiso_ratings (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  compromiso_record_id  INT NOT NULL,
  activity_code         VARCHAR(10) NOT NULL,   -- pa1, aq2, do3, cc1...
  objective             CHAR(2)     NOT NULL,   -- O1..O4
  rating                TINYINT     NULL,       -- 1-5; NULL = "No aplica" (no promedia)
  comment               VARCHAR(500) NULL,
  CONSTRAINT fk_compromiso_rating FOREIGN KEY (compromiso_record_id) REFERENCES compromiso_records(id) ON DELETE CASCADE,
  INDEX idx_compromiso_rating_record (compromiso_record_id)
) ENGINE=InnoDB;

-- El usuario admin por defecto se crea con backend/seed.php
-- (así la contraseña se hashea correctamente con password_hash()).
