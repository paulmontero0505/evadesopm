<?php
// ============================================================
//  Front controller / router de la API
//  URL base:  http://localhost/evadesopm/backend/index.php/<ruta>
// ============================================================

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/config/config.php';
send_cors_headers();

// Manejo global de errores → JSON.
// En producción el detalle va al log, nunca al navegador.
set_exception_handler(function (Throwable $e) {
    error_log('[evadesopm] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    json_error(DEBUG ? 'Error interno: ' . $e->getMessage() : 'Error interno del servidor', 500);
});

require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/api/auth.php';
require_once __DIR__ . '/api/audit.php';
require_once __DIR__ . '/api/rules.php';
require_once __DIR__ . '/api/opms.php';
require_once __DIR__ . '/api/shifts.php';
require_once __DIR__ . '/api/compromiso.php';
require_once __DIR__ . '/api/evaluations.php';
require_once __DIR__ . '/api/users.php';
require_once __DIR__ . '/api/assignments.php';
require_once __DIR__ . '/api/radios.php';

$method = $_SERVER['REQUEST_METHOD'];

// Ruta: en Apache viene por PATH_INFO; en php -S se toma de REQUEST_URI.
$path = $_SERVER['PATH_INFO'] ?? '';
if ($path === '') {
    $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if (($pos = strpos($uri, 'index.php')) !== false) {
        $uri = substr($uri, $pos + strlen('index.php'));
    }
    $path = $uri;
}
$seg = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));

// Auditoría automática de toda petición que modifica datos.
audit_register_request($method, $path);

// --- Enrutamiento ---
$r0 = $seg[0] ?? '';
$r1 = $seg[1] ?? '';
$r2 = $seg[2] ?? '';
$r3 = $seg[3] ?? '';

switch ($r0) {
    case 'auth':
        if ($r1 === 'login'  && $method === 'POST') return handle_login();
        if ($r1 === 'me'     && $method === 'GET')  return handle_me();
        if ($r1 === 'logout' && $method === 'POST') return handle_logout();
        if ($r1 === 'change-password' && $method === 'POST') return handle_change_password();
        break;

    case 'rules':
        if ($method === 'GET') return handle_rules();
        break;

    case 'opms':
        if ($r1 === 'template' && $method === 'GET') return handle_opms_template();
        if ($r1 === 'export' && $method === 'GET') return handle_opms_export();
        if ($r1 === 'import' && $method === 'POST') return handle_opms_import();
        if ($r1 === '' && $method === 'GET')    return handle_opms_list();
        if ($r1 === '' && $method === 'POST')   return handle_opm_create();
        if ($r1 !== '' && $method === 'PUT')    return handle_opm_update((int)$r1);
        if ($r1 !== '' && $method === 'DELETE') return handle_opm_delete((int)$r1);
        break;

    case 'supervisor-assignments':
        if ($r1 === 'template' && $method === 'GET') return handle_supervisor_assignments_template();
        if ($r1 === 'import' && $method === 'POST') return handle_supervisor_assignments_import();
        if ($r1 === 'individual' && $method === 'POST') return handle_supervisor_assignment_create_individual();
        if ($r1 !== '' && $method === 'DELETE') return handle_supervisor_assignment_delete((int)$r1);
        if ($r1 === '' && $method === 'GET') return handle_supervisor_assignments_list();
        break;
    case 'radios':
        if ($r1 === 'catalog' && $r2 === 'template' && $method === 'GET') return handle_radios_catalog_template();
        if ($r1 === 'catalog' && $r2 === 'report' && $method === 'GET') return handle_radios_catalog_report();
        if ($r1 === 'locations' && $method === 'GET') return handle_radio_locations();
        if ($r1 === 'catalog' && $r2 === 'import' && $method === 'POST') return handle_radios_catalog_import();
        if ($r1 === 'catalog' && $method === 'GET') return handle_radios_catalog_list();
        if ($r1 === 'catalog' && $method === 'POST') return handle_radios_catalog_create();
        if ($r1 === 'catalog' && $r2 !== '' && $method === 'PUT') return handle_radios_catalog_update((int)$r2);
        if ($r1 === 'catalog' && $r2 !== '' && $method === 'DELETE') return handle_radios_catalog_delete((int)$r2);
        if ($r1 === 'assignments' && $r2 === 'group' && $method === 'POST') return handle_radio_assignment_group_update();
        if ($r1 === 'assignments' && $r2 !== '' && $r3 === 'collaborator' && $method === 'POST') return handle_radio_assignment_collaborator((int)$r2);
        if ($r1 === 'assignments' && $r2 !== '' && $method === 'POST') return handle_radio_assignment_update((int)$r2);
        if ($r1 === 'assignments' && $r2 !== '' && $method === 'DELETE') return handle_radio_assignment_delete((int)$r2);
        if ($r1 === 'assignments' && $method === 'POST') return handle_radio_batch_assignment_create();
        if ($r1 === 'movements' && $method === 'POST') return handle_radio_movements();
        if ($r1 === 'returns' && $method === 'POST') return handle_radio_return();
        if ($r1 === 'overview' && $method === 'GET') return handle_radio_overview();
        if ($r1 === 'reports' && $r2 === 'daily' && $method === 'GET') return handle_radio_daily_report();
        if ($r1 === 'reports' && $method === 'GET') return handle_radio_reports();
        if ($r1 === '' && $method === 'GET') return handle_radio_context();
        break;

    case 'shift-records':
        if ($r1 === '' && $method === 'GET')    return handle_shifts_list();
        if ($r1 === '' && $method === 'POST')   return handle_shift_create();
        if ($r1 !== '' && $method === 'GET')    return handle_shift_get((int)$r1);
        if ($r1 !== '' && $method === 'POST')   return handle_shift_update((int)$r1);
        if ($r1 !== '' && $method === 'DELETE') return handle_shift_delete((int)$r1);
        break;

    case 'control':
        if ($method === 'GET') return handle_control();
        break;

    case 'compromiso-rules':
        if ($method === 'GET') return handle_rules_compromiso();
        break;

    case 'control-compromiso':
        if ($method === 'GET') return handle_control_compromiso();
        break;

    case 'compromiso-records':
        if ($r1 === '' && $method === 'GET')    return handle_compromiso_list();
        if ($r1 === '' && $method === 'POST')   return handle_compromiso_create();
        if ($r1 !== '' && $method === 'GET')    return handle_compromiso_get((int)$r1);
        if ($r1 !== '' && $method === 'POST')   return handle_compromiso_update((int)$r1);
        if ($r1 !== '' && $method === 'DELETE') return handle_compromiso_delete((int)$r1);
        break;

    case 'evaluations':
        if ($r1 === '' && $method === 'GET')  return handle_evaluations_list();
        if ($r1 === '' && $method === 'POST') return handle_evaluation_save();
        if ($r1 !== '' && $method === 'GET')  return handle_evaluation_get((int)$r1);
        break;

    case 'users':
        if ($r1 === 'template' && $method === 'GET') return handle_users_template();
        if ($r1 === 'import' && $method === 'POST') return handle_users_import();
        if ($r1 === '' && $method === 'GET')    return handle_users_list();
        if ($r1 === '' && $method === 'POST')   return handle_user_create();
        if ($r1 !== '' && $method === 'PUT')    return handle_user_update((int)$r1);
        if ($r1 !== '' && $method === 'DELETE') return handle_user_delete((int)$r1);
        break;

    case 'assignments':
        if ($r1 === 'individual' && $method === 'POST') return handle_assignment_create_individual();
        if ($r1 === 'template' && $method === 'GET') return handle_assignments_template();
        if ($r1 === 'import' && $method === 'POST') return handle_assignments_import();
        if ($r1 === '' && $method === 'DELETE') return handle_assignments_delete_shift();
        if ($r1 === '' && $method === 'GET') return handle_assignments_list();
        break;

    case 'turno-team':
        if ($r1 === '' && $method === 'GET') return handle_shift_team_list();
        break;

    case 'audit':
        if ($r1 === '' && $method === 'GET') return handle_audit_list();
        break;

    case '':
        return json_response(['name' => 'Sistema de Desempeño OPM API', 'status' => 'ok']);
}

json_error('Ruta no encontrada: ' . $method . ' /' . implode('/', $seg), 404);
