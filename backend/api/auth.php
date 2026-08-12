<?php
require_once __DIR__ . '/../lib/auth.php';

/** POST /auth/login  { employee_number, password } */
function handle_login(): void
{
    $body = json_body();
    $emp  = trim($body['employee_number'] ?? '');
    $pass = (string)($body['password'] ?? '');

    if ($emp === '' || $pass === '') {
        json_error('Número de empleado y contraseña son obligatorios', 422);
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE employee_number = ? AND active = 1');
    $stmt->execute([$emp]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pass, $user['password_hash'])) {
        json_error('Credenciales incorrectas', 401);
    }

    $token = create_token((int)$user['id']);
    json_response([
        'token' => $token,
        'user'  => [
            'id'              => (int)$user['id'],
            'employee_number' => $user['employee_number'],
            'full_name'       => $user['full_name'],
            'role'            => $user['role'],
            'password_change_required' => (bool)($user['password_change_required'] ?? false),
        ],
    ]);
}

/** GET /auth/me */
function handle_me(): void
{
    $user = require_auth();
    json_response(['user' => [
        'id'              => (int)$user['id'],
        'employee_number' => $user['employee_number'],
        'full_name'       => $user['full_name'],
        'role'            => $user['role'],
        'password_change_required' => (bool)($user['password_change_required'] ?? false),
    ]]);
}

/** POST /auth/change-password (personal con clave asignada por administración) */
function handle_change_password(): void
{
    $user = require_auth();
    if (!in_array($user['role'], ['supervisor', 'coordinator', 'labor'], true) || empty($user['password_change_required'])) {
        json_error('El cambio de contraseña no está disponible para esta cuenta', 403);
    }

    $body = json_body();
    $password = (string)($body['password'] ?? '');
    if (mb_strlen($password) < 8) {
        json_error('La nueva contraseña debe tener al menos 8 caracteres', 422);
    }

    $pdo = db();
    $pdo->prepare('UPDATE users SET password_hash = ?, password_change_required = 0 WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);

    // Mantiene activa esta sesión y cierra las demás sesiones anteriores.
    $token = bearer_token();
    if ($token) {
        $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND token <> ?')->execute([$user['id'], $token]);
    }

    $user['password_change_required'] = false;
    json_response(['ok' => true, 'user' => [
        'id' => (int)$user['id'],
        'employee_number' => $user['employee_number'],
        'full_name' => $user['full_name'],
        'role' => $user['role'],
        'password_change_required' => false,
    ]]);
}

/** POST /auth/logout */
function handle_logout(): void
{
    $token = bearer_token();
    if ($token) {
        db()->prepare('DELETE FROM auth_tokens WHERE token = ?')->execute([$token]);
    }
    json_response(['ok' => true]);
}
