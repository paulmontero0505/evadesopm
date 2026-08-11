<?php
// ============================================================
//  Configuración central del backend
// ============================================================

// En producción NO se editan estos valores: se crea config.local.php al lado
// de este archivo (ver config.local.example.php). Ese archivo no se versiona
// ni se sube al repositorio, solo al servidor.
$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    require_once $local;
}

// Valores por defecto de XAMPP, usados solo si no hay config.local.php
defined('DB_HOST')    || define('DB_HOST', '127.0.0.1');
defined('DB_NAME')    || define('DB_NAME', 'evadesopm');
defined('DB_USER')    || define('DB_USER', 'root');
defined('DB_PASS')    || define('DB_PASS', '');   // XAMPP: root sin contraseña
defined('DB_CHARSET') || define('DB_CHARSET', 'utf8mb4');

// --- Modo depuración ---
// true muestra el detalle de los errores en la respuesta JSON.
defined('DEBUG') || define('DEBUG', false);

// --- Duración del token de sesión (segundos) ---
define('TOKEN_TTL', 60 * 60 * 12);   // 12 horas

date_default_timezone_set('America/Lima');
