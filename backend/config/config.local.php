<?php
// ============================================================
//  Configuración LOCAL (XAMPP) para desarrollo/pruebas en esta máquina.
//  Este archivo NUNCA se sube al repositorio.
//
//  Las credenciales reales de producción (cPanel) están en
//  config.local.cpanel.php — ese es el que se sube al servidor,
//  reemplazando a este archivo (con el mismo nombre config.local.php)
//  en backend/config/ del hosting.
// ============================================================

define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'evadesopm');
define('DB_USER', 'root');
define('DB_PASS', '');   // XAMPP: root sin contraseña
define('DB_CHARSET', 'utf8mb4');

define('DEBUG', false);
