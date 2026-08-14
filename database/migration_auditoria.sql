-- Módulo de auditoría: registra cada cambio/registro que se hace en el sistema
-- (crear, editar, eliminar, importar, relevar, devolver, etc.) junto con el
-- usuario que lo realizó, el módulo, la ruta, un resumen de los datos enviados,
-- el código de respuesta y la fecha/hora.
--
-- Ejecutar una sola vez en phpMyAdmin.
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(150) NULL,
  user_role VARCHAR(30) NULL,
  method VARCHAR(10) NOT NULL,
  module VARCHAR(60) NULL,
  action VARCHAR(150) NULL,
  path VARCHAR(255) NOT NULL,
  entity_id VARCHAR(40) NULL,
  status_code INT NULL,
  details TEXT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_module (module),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
