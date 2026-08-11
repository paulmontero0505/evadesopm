-- Ejecutar una vez en las instalaciones ya creadas.
ALTER TABLE users
  ADD COLUMN password_change_required TINYINT(1) NOT NULL DEFAULT 0
  AFTER active;
