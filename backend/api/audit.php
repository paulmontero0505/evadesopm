<?php
require_once __DIR__ . '/../lib/auth.php';

/** GET /audit — listado de auditoría con filtros (solo admin). */
function handle_audit_list(): void
{
    require_role(['admin']);
    $from = trim($_GET['from'] ?? '');
    $to = trim($_GET['to'] ?? '');
    $userId = (int)($_GET['user_id'] ?? 0);
    $module = trim($_GET['module'] ?? '');
    $q = trim($_GET['q'] ?? '');
    $limit = min(1000, max(1, (int)($_GET['limit'] ?? 300)));

    $where = [];
    $params = [];
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) { $where[] = 'a.created_at >= ?'; $params[] = "$from 00:00:00"; }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) { $where[] = 'a.created_at <= ?'; $params[] = "$to 23:59:59"; }
    if ($userId) { $where[] = 'a.user_id = ?'; $params[] = $userId; }
    if ($module !== '') { $where[] = 'a.module = ?'; $params[] = $module; }
    if ($q !== '') {
        $where[] = '(a.action LIKE ? OR a.details LIKE ? OR a.user_name LIKE ? OR a.path LIKE ?)';
        $like = "%$q%";
        array_push($params, $like, $like, $like, $like);
    }

    $sql = 'SELECT a.id, a.user_id, a.user_name, a.user_role, a.method, a.module, a.action, a.path, a.entity_id, a.status_code, a.details, a.ip, a.created_at FROM audit_logs a';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY a.id DESC LIMIT ' . $limit;

    try {
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll();
        $modules = db()->query("SELECT DISTINCT module FROM audit_logs WHERE module IS NOT NULL AND module <> '' ORDER BY module")->fetchAll(PDO::FETCH_COLUMN);
        $users = db()->query("SELECT DISTINCT user_id, user_name FROM audit_logs WHERE user_id IS NOT NULL AND user_name IS NOT NULL ORDER BY user_name")->fetchAll();
    } catch (PDOException $e) {
        if ($e->getCode() === '42S02') {
            json_error('Actualización pendiente: importe database/migration_auditoria.sql en phpMyAdmin para activar la auditoría.', 422);
        }
        throw $e;
    }

    json_response(['records' => $records, 'modules' => $modules, 'users' => $users]);
}
