<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

/** Genera un token nuevo para un usuario y lo guarda. */
function create_token(int $userId): string
{
    $token   = bin2hex(random_bytes(32));      // 64 chars
    $expires = date('Y-m-d H:i:s', time() + TOKEN_TTL);
    $stmt = db()->prepare(
        'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    );
    $stmt->execute([$userId, $token, $expires]);
    return $token;
}

/** Extrae el token del header Authorization: Bearer xxx */
function bearer_token(): ?string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
        return $m[1];
    }
    return null;
}

/** Devuelve el usuario autenticado o null. */
function current_user(): ?array
{
    $token = bearer_token();
    if (!$token) {
        return null;
    }
    $sql = 'SELECT u.id, u.employee_number, u.full_name, u.role, u.active, u.password_change_required
              FROM auth_tokens t
              JOIN users u ON u.id = t.user_id
             WHERE t.token = ? AND t.expires_at > NOW() AND u.active = 1';
    try {
        $stmt = db()->prepare($sql);
        $stmt->execute([$token]);
        $user = $stmt->fetch();
    } catch (PDOException $e) {
        // Compatibilidad durante el despliegue: permite seguir usando el sistema
        // mientras se ejecuta la migración que agrega la nueva columna.
        if ($e->getCode() !== '42S22') {
            throw $e;
        }
        $stmt = db()->prepare(
            'SELECT u.id, u.employee_number, u.full_name, u.role, u.active
               FROM auth_tokens t
               JOIN users u ON u.id = t.user_id
              WHERE t.token = ? AND t.expires_at > NOW() AND u.active = 1'
        );
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        if ($user) {
            $user['password_change_required'] = 0;
        }
    }
    return $user ?: null;
}

/** Exige sesión válida; corta con 401 si no. */
function require_auth(): array
{
    $user = current_user();
    if (!$user) {
        json_error('No autorizado', 401);
    }
    return $user;
}

/** Exige que el usuario tenga uno de los roles dados. */
function require_role(array $roles): array
{
    $user = require_auth();
    if (!in_array($user['role'], $roles, true)) {
        json_error('Permiso denegado', 403);
    }
    return $user;
}

/** Exige que el OPM figure en la asignación operativa de la fecha y turno indicados. */
function require_opm_assignment(int $opmId, string $date, string $turno): void
{
    $stmt = db()->prepare(
        'SELECT 1 FROM opm_assignments WHERE opm_id = ? AND work_date = ? AND turno = ?'
    );
    $stmt->execute([$opmId, $date, $turno]);
    if (!$stmt->fetchColumn()) {
        json_error('Este OPM no está asignado al turno seleccionado', 422);
    }
}
