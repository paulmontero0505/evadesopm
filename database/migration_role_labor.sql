-- Ejecutar una vez en cPanel para habilitar el rol Labor.
ALTER TABLE users MODIFY role ENUM('admin','supervisor','coordinator','labor') NOT NULL DEFAULT 'supervisor';
