ALTER TABLE radios
  ADD COLUMN condition_status ENUM('Pantalla Rota','Excelente Estado','Botones Dañados') NOT NULL DEFAULT 'Excelente Estado' AFTER location;
