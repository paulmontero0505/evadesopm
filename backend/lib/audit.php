<?php
// ============================================================
//  Auditoría: registra automáticamente cada petición que modifica datos
//  (POST/PUT/DELETE con respuesta exitosa) junto con el usuario que la hizo.
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

/**
 * Captura el contexto de la petición y programa el registro al finalizar,
 * cuando ya se conoce el código de respuesta. Solo audita métodos que
 * cambian datos y respuestas exitosas (2xx/3xx).
 */
function audit_register_request(string $method, string $path): void
{
    $method = strtoupper($method);
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;

    // Se captura el cuerpo ahora, antes de que los handlers consuman php://input.
    $raw = file_get_contents('php://input');
    $post = $_POST;
    $files = array_keys($_FILES ?? []);
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;

    register_shutdown_function(function () use ($method, $path, $raw, $post, $files, $ip) {
        try {
            $status = http_response_code() ?: 200;
            if ($status < 200 || $status >= 400) return; // solo cambios efectivos

            $user = null;
            try { $user = current_user(); } catch (Throwable $e) { $user = null; }

            [$module, $action, $entityId] = audit_describe($method, $path);
            $details = audit_build_details((string)$raw, is_array($post) ? $post : [], $files);

            $stmt = db()->prepare(
                'INSERT INTO audit_logs (user_id,user_name,user_role,method,module,action,path,entity_id,status_code,details,ip)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $user['id'] ?? null,
                $user['full_name'] ?? null,
                $user['role'] ?? null,
                $method,
                $module,
                $action,
                mb_substr($path, 0, 255),
                $entityId,
                $status,
                $details,
                $ip,
            ]);
        } catch (Throwable $e) {
            // La auditoría nunca debe romper la respuesta principal.
            error_log('[evadesopm audit] ' . $e->getMessage());
        }
    });
}

/** Oculta valores sensibles (contraseñas, tokens, hashes). */
function audit_redact(array $data): array
{
    $out = [];
    foreach ($data as $k => $v) {
        if (preg_match('/pass|token|hash|secret/i', (string)$k)) { $out[$k] = '***'; continue; }
        $out[$k] = is_array($v) ? audit_redact($v) : $v;
    }
    return $out;
}

/** Construye un resumen JSON (redactado y truncado) de lo enviado en la petición. */
function audit_build_details(string $raw, array $post, array $files): ?string
{
    $data = [];
    if ($raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) $data = $json;
    }
    foreach ($post as $k => $v) {
        if ($k === 'payload') {
            $decoded = json_decode((string)$v, true);
            if (is_array($decoded)) { $data = array_merge($data, $decoded); continue; }
        }
        $data[$k] = $v;
    }
    if ($files) $data['_archivos'] = $files;
    if (!$data) return null;
    $encoded = json_encode(audit_redact($data), JSON_UNESCAPED_UNICODE);
    return $encoded === false ? null : mb_substr($encoded, 0, 4000);
}

/** Deriva módulo, acción legible e id de entidad a partir del método y la ruta. */
function audit_describe(string $method, string $path): array
{
    $seg = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));
    $r0 = $seg[0] ?? '';
    $modules = [
        'radios' => 'Radios',
        'opms' => 'Colaboradores',
        'users' => 'Usuarios',
        'assignments' => 'Asignaciones OPM',
        'supervisor-assignments' => 'Asignaciones supervisores',
        'shift-records' => 'Fichas de turno',
        'compromiso-records' => 'Compromisos',
        'evaluations' => 'Evaluaciones',
        'auth' => 'Sesión',
        'turno-team' => 'Cuadrilla',
    ];
    $module = $modules[$r0] ?? ($r0 ?: '—');

    $entityId = null;
    foreach (array_reverse($seg) as $s) { if (ctype_digit($s)) { $entityId = $s; break; } }

    return [$module, audit_action_label($method, $seg), $entityId];
}

/** Etiqueta legible de la acción (en español) para las rutas más comunes. */
function audit_action_label(string $method, array $seg): string
{
    $r0 = $seg[0] ?? ''; $r1 = $seg[1] ?? ''; $r2 = $seg[2] ?? ''; $r3 = $seg[3] ?? '';
    $verb = ['POST' => 'Registrar', 'PUT' => 'Actualizar', 'DELETE' => 'Eliminar'][$method] ?? $method;

    if ($r0 === 'radios') {
        if ($r1 === 'movements') return 'Relevo / movimiento de radios';
        if ($r1 === 'returns') return 'Devolución de radios';
        if ($r1 === 'assignments' && $r2 === 'group') return 'Editar grupo de entrega';
        if ($r1 === 'assignments' && $r3 === 'collaborator') return 'Asignar colaborador a radio';
        if ($r1 === 'assignments' && ctype_digit((string)$r2)) return $method === 'DELETE' ? 'Eliminar entrega de radios' : 'Editar entrega de radios';
        if ($r1 === 'assignments') return 'Registrar entrega de radios';
        if ($r1 === 'catalog' && $r2 === 'import') return 'Importar catálogo de radios';
        if ($r1 === 'catalog') return $verb . ' radio (catálogo)';
    }
    if ($r0 === 'auth') {
        if ($r1 === 'login') return 'Inicio de sesión';
        if ($r1 === 'logout') return 'Cierre de sesión';
        if ($r1 === 'change-password') return 'Cambio de contraseña';
    }
    if ($r1 === 'import') return 'Importar ' . strtolower(audit_describe($method, $seg)[0]);
    if ($r1 === 'individual') return 'Agregar individual';

    $noun = [
        'opms' => 'colaborador', 'users' => 'usuario', 'shift-records' => 'ficha de turno',
        'compromiso-records' => 'compromiso', 'evaluations' => 'evaluación',
        'assignments' => 'asignación', 'supervisor-assignments' => 'asignación de supervisor',
    ][$r0] ?? $r0;
    return trim($verb . ' ' . $noun);
}
