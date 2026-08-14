<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/xlsx.php';

const RADIO_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const RADIO_PHOTO_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
const RADIO_CONDITIONS = ['Pantalla Rota', 'Excelente Estado', 'Botones Dañados'];

function radio_shift_is_valid(string $date, string $turno): bool {
    return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && in_array($turno, ['dia', 'noche'], true);
}
function radio_payload(): array { return isset($_POST['payload']) ? (json_decode($_POST['payload'], true) ?: []) : json_body(); }
function radio_records_sql(): string {
    return "SELECT ra.*, (SELECT MAX(m.created_at) FROM radio_assignment_movements m WHERE m.radio_assignment_id=ra.id) AS last_movement_at, COALESCE(ra.delivery_group, CONCAT('legacy-', ra.id)) AS group_id, r.code AS radio_code, r.imei, r.model, u.full_name AS supervisor_name, u.role AS supervisor_role, custodian.full_name AS current_supervisor_name, creator.full_name AS registered_by_name, returner.full_name AS returned_by_name, o.id AS collaborator_id, o.code AS collaborator_code, o.full_name AS collaborator_name, o.puesto AS collaborator_puesto FROM radio_assignments ra JOIN radios r ON r.id=ra.radio_id JOIN users u ON u.id=ra.supervisor_id LEFT JOIN users custodian ON custodian.id=COALESCE(ra.current_supervisor_id, ra.supervisor_id) JOIN users creator ON creator.id=ra.registered_by LEFT JOIN users returner ON returner.id=ra.returned_by LEFT JOIN radio_assignment_collaborators rac ON rac.radio_assignment_id=ra.id LEFT JOIN opms o ON o.id=rac.opm_id ";
}
function save_radio_photo(string $field = 'radio_photo'): ?string {
    if (empty($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) return null;
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) json_error('Error al subir la foto.', 422);
    if ($file['size'] > RADIO_PHOTO_MAX_BYTES) json_error('La foto es demasiado grande (máx. 8 MB).', 422);
    $mime = mime_content_type($file['tmp_name']);
    if (!isset(RADIO_PHOTO_MIME[$mime])) json_error('La foto debe ser JPG, PNG o WEBP.', 422);
    $dir = __DIR__ . '/../../uploads/radios';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) json_error('No se pudo preparar el directorio de fotos.', 500);
    $name = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . RADIO_PHOTO_MIME[$mime];
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) json_error('No se pudo guardar la foto.', 500);
    return 'uploads/radios/' . $name;
}

function handle_supervisor_assignments_list(): void {
    require_auth(); $date = $_GET['date'] ?? ''; $turno = $_GET['turno'] ?? '';
    $stmt = db()->prepare("SELECT a.*, u.full_name, u.employee_number, u.role FROM supervisor_assignments a JOIN users u ON u.id=a.user_id WHERE a.work_date=? AND a.turno=? ORDER BY u.full_name");
    $stmt->execute([$date, $turno]); json_response(['assignments' => $stmt->fetchAll()]);
}
function handle_supervisor_assignments_template(): void {
    require_role(['admin']); $bytes = xlsx_build_assignments_template('SUPERVISORES');
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="plantilla_asignacion_supervisores.xlsx"'); echo $bytes; exit;
}
function handle_supervisor_assignments_import(): void {
    $me=require_role(['admin']); $date=$_POST['date']??''; $turno=$_POST['turno']??''; $puesto=mb_substr(trim($_POST['puesto']??''),0,150);
    if (!radio_shift_is_valid($date, $turno) || empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) json_error('Seleccione fecha, turno y plantilla.',422);
    if ($puesto === '') json_error('Seleccione el cargo para estas asignaciones.',422);
    try { $rows=xlsx_read_assignments($_FILES['file']['tmp_name']); } catch(Throwable $e){ json_error($e->getMessage(),422); }
    $users=db()->prepare("SELECT id,full_name FROM users WHERE active=1 AND role IN ('supervisor','coordinator') AND puesto=?"); $users->execute([$puesto]); $users=$users->fetchAll();
    $by=[]; foreach($users as $u) $by[mb_strtoupper(trim($u['full_name']))]=(int)$u['id'];
    $pdo=db(); $pdo->beginTransaction(); $valid=0;
    try { $delete=$pdo->prepare('DELETE a FROM supervisor_assignments a JOIN users u ON u.id=a.user_id WHERE a.work_date=? AND a.turno=? AND u.puesto=?'); $delete->execute([$date,$turno,$puesto]);
      $insert=$pdo->prepare('INSERT INTO supervisor_assignments (user_id,work_date,turno,funcion_1,funcion_2,zona_1,puesto,nave,nave_2,imported_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
      foreach($rows as $r){$id=$by[mb_strtoupper(trim($r['name']??''))]??null;if(!$id || supervisor_worked_previous_shift((int)$id,$date,$turno))continue;$insert->execute([$id,$date,$turno,$r['funcion_1']?:null,$r['funcion_2']?:null,$r['zona_1']?:null,$puesto,$r['nave']?:null,$r['nave_2']?:null,$me['id']]);$valid++;}
      $pdo->commit(); } catch(Throwable $e){$pdo->rollBack();throw $e;}
    json_response(['ok'=>true,'imported'=>$valid]);
}
function handle_supervisor_assignment_create_individual(): void {
    $me=require_role(['admin']); $b=json_body(); $userId=(int)($b['user_id']??0); $date=trim($b['date']??''); $turno=$b['turno']??'';
    if(!$userId || !radio_shift_is_valid($date,$turno)) json_error('Seleccione supervisor o coordinador, fecha y turno válidos.',422);
    $user=db()->prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('supervisor','coordinator')"); $user->execute([$userId]); if(!$user->fetchColumn()) json_error('El usuario no es un supervisor o coordinador activo.',422);
    if(supervisor_worked_previous_shift($userId,$date,$turno)) json_error('El supervisor o coordinador cubrio el turno anterior y debe descansar antes de otro turno.',422);
    $values=[]; foreach(['funcion_1','funcion_2','zona_1','puesto','nave','nave_2'] as $field)$values[$field]=mb_substr(trim($b[$field]??''),0,150)?:null;
    db()->prepare('INSERT INTO supervisor_assignments (user_id,work_date,turno,funcion_1,funcion_2,zona_1,puesto,nave,nave_2,imported_by) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE funcion_1=VALUES(funcion_1),funcion_2=VALUES(funcion_2),zona_1=VALUES(zona_1),puesto=VALUES(puesto),nave=VALUES(nave),nave_2=VALUES(nave_2),imported_by=VALUES(imported_by)')->execute([$userId,$date,$turno,$values['funcion_1'],$values['funcion_2'],$values['zona_1'],$values['puesto'],$values['nave'],$values['nave_2'],$me['id']]);
    json_response(['ok'=>true]);
}
function handle_supervisor_assignment_delete(int $id): void {
    require_role(['admin']);
    $stmt = db()->prepare('DELETE FROM supervisor_assignments WHERE id=?');
    $stmt->execute([$id]);
    if (!$stmt->rowCount()) json_error('No se encontró la asignación.', 404);
    json_response(['ok' => true]);
}

function handle_radios_catalog_list(): void {
    require_role(['admin']);
    $sql = "SELECT r.*, last_assignment.location AS last_location, last_assignment.nave AS last_nave, last_assignment.work_date AS last_work_date, last_assignment.turno AS last_turno FROM radios r LEFT JOIN radio_assignments last_assignment ON last_assignment.id=(SELECT ra.id FROM radio_assignments ra WHERE ra.radio_id=r.id ORDER BY ra.updated_at DESC, ra.id DESC LIMIT 1) ORDER BY r.active DESC, CAST(r.code AS UNSIGNED), r.code";
    json_response(['radios' => db()->query($sql)->fetchAll()]);
}
function handle_radios_catalog_template(): void {
    require_role(['admin']); $bytes=xlsx_build_radios_template();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); header('Content-Disposition: attachment; filename="plantilla_radios.xlsx"'); header('Content-Length: '.strlen($bytes)); echo $bytes; exit;
}
function radio_location_filters(): array {
    $query = mb_substr(trim($_GET['q'] ?? ''), 0, 150);
    $status = trim($_GET['status'] ?? '');
    $operational = trim($_GET['operational'] ?? '');
    if ($status !== '' && !in_array($status, ['Excelente Estado', 'Con observaciones'], true)) json_error('Estado de radio inválido.', 422);
    if ($operational !== '' && !in_array($operational, ['in_operations', 'available'], true)) json_error('Estado operativo inválido.', 422);
    return [$query, $status, $operational];
}
function radio_location_records(string $query, string $status, string $operational): array {
    $sql = "SELECT r.id, r.code, r.imei, r.model, r.active, COALESCE(assignment.condition_status, history.condition_status, r.condition_status, 'Excelente Estado') AS condition_status, COALESCE(assignment.location, history.location, r.location, '') AS last_location, COALESCE(assignment.nave, history.nave, '') AS last_nave, collaborator.full_name AS collaborator_name, custodian.full_name AS custodian_name, CASE WHEN assignment.id IS NULL THEN 0 ELSE 1 END AS in_operations FROM radios r LEFT JOIN radio_assignments assignment ON assignment.id=(SELECT ra.id FROM radio_assignments ra WHERE ra.radio_id=r.id AND ra.returned_at IS NULL ORDER BY ra.updated_at DESC, ra.id DESC LIMIT 1) LEFT JOIN radio_assignments history ON history.id=(SELECT ra.id FROM radio_assignments ra WHERE ra.radio_id=r.id ORDER BY ra.updated_at DESC, ra.id DESC LIMIT 1) LEFT JOIN users custodian ON custodian.id=COALESCE(assignment.current_supervisor_id, assignment.supervisor_id) LEFT JOIN radio_assignment_collaborators rac ON rac.radio_assignment_id=assignment.id LEFT JOIN opms collaborator ON collaborator.id=rac.opm_id WHERE r.active=1";
    $params = [];
    if ($query !== '') {
        $like = '%' . $query . '%';
        $sql .= ' AND (r.code LIKE ? OR r.imei LIKE ? OR r.model LIKE ? OR COALESCE(assignment.location, r.location, \'\') LIKE ? OR collaborator.full_name LIKE ? OR custodian.full_name LIKE ?)';
        $params = [$like, $like, $like, $like, $like, $like];
    }
    if ($status === 'Excelente Estado') { $sql .= " AND COALESCE(assignment.condition_status, r.condition_status, 'Excelente Estado')='Excelente Estado'"; }
    if ($status === 'Con observaciones') { $sql .= " AND COALESCE(assignment.condition_status, r.condition_status, 'Excelente Estado')<>'Excelente Estado'"; }
    if ($operational === 'in_operations') { $sql .= ' AND assignment.id IS NOT NULL'; }
    if ($operational === 'available') { $sql .= ' AND assignment.id IS NULL'; }
    $sql .= ' ORDER BY CAST(r.code AS UNSIGNED), r.code';
    $stmt = db()->prepare($sql); $stmt->execute($params);
    return $stmt->fetchAll();
}
function handle_radio_locations(): void {
    require_role(['admin', 'coordinator']);
    [$query, $status, $operational] = radio_location_filters();
    $records = radio_location_records($query, $status, $operational);
    json_response(['records' => $records, 'metrics' => ['total' => count($records), 'in_operations' => count(array_filter($records, fn($record) => (bool)$record['in_operations'])), 'observations' => count(array_filter($records, fn($record) => $record['condition_status'] !== 'Excelente Estado'))]]);
}
function handle_radios_catalog_report(): void {
    require_role(['admin', 'coordinator']);
    [$query, $status, $operational] = radio_location_filters();
    $bytes = xlsx_build_radio_locations_report(radio_location_records($query, $status, $operational));
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); header('Content-Disposition: attachment; filename="reporte_ubicaciones_radios.xlsx"'); echo $bytes; exit;
}
function handle_radios_catalog_import(): void {
    require_role(['admin']);
    if(empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) json_error('Adjunte la plantilla Excel de radios.',422);
    $file=$_FILES['file']; if($file['error']!==UPLOAD_ERR_OK || $file['size']>10*1024*1024 || !preg_match('/\.xlsx$/i',$file['name'])) json_error('El archivo debe ser un Excel .xlsx de hasta 10 MB.',422);
    try{$rows=xlsx_read_radios($file['tmp_name']);}catch(Throwable $e){json_error('No se pudo leer el Excel: '.$e->getMessage(),422);} if(!$rows)json_error('No se encontraron radios en la plantilla.',422);
    $stmt=db()->prepare('INSERT INTO radios (code,imei,model,location) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE imei=VALUES(imei),model=VALUES(model),location=VALUES(location),active=1'); $created=0;$updated=0;$errors=[];
    foreach($rows as $row){$code=mb_substr($row['code'],0,80);$imei=mb_substr($row['imei'],0,80);$model=mb_substr($row['model'],0,120);$location=mb_substr($row['location'],0,150)?:null;if(!$code||!$imei||!$model){$errors[]=$row['row'];continue;}try{$stmt->execute([$code,$imei,$model,$location]);$stmt->rowCount()===1?$created++:$updated++;}catch(Throwable $e){$errors[]=$row['row'];}}
    json_response(['ok'=>true,'created'=>$created,'updated'=>$updated,'errors'=>$errors]);
}
function handle_radios_catalog_create(): void {
    require_role(['admin']); $b=json_body();
    $code=mb_substr(trim($b['code']??''),0,80); $imei=mb_substr(trim($b['imei']??''),0,80); $model=mb_substr(trim($b['model']??''),0,120); $location=mb_substr(trim($b['location']??''),0,150) ?: null; $condition=$b['condition_status']??'Excelente Estado';
    if(!$code || !$imei || !$model) json_error('Código, IMEI y modelo son obligatorios.',422);
    if(!in_array($condition,RADIO_CONDITIONS,true)) json_error('Estado de radio no valido.',422);
    try { db()->prepare('INSERT INTO radios (code,imei,model,location,condition_status) VALUES (?,?,?,?,?)')->execute([$code,$imei,$model,$location,$condition]); }
    catch(PDOException $e){ if($e->getCode()==='23000') json_error('El código o IMEI ya está registrado.',409); throw $e; }
    json_response(['ok'=>true,'id'=>(int)db()->lastInsertId()],201);
}
function handle_radios_catalog_update(int $id): void {
    require_role(['admin']); $b=json_body(); $sets=[]; $params=[];
    foreach(['code'=>80,'imei'=>80,'model'=>120,'location'=>150] as $field=>$limit) if(array_key_exists($field,$b)){ $value=mb_substr(trim((string)$b[$field]),0,$limit); if(in_array($field,['code','imei','model'],true)&&$value==='') json_error('Código, IMEI y modelo no pueden quedar vacíos.',422); $sets[]="$field=?"; $params[]=$value?:null; }
    if(array_key_exists('condition_status',$b)){ $status=trim((string)$b['condition_status']); if(!in_array($status,RADIO_CONDITIONS,true)) json_error('Estado de radio no valido.',422); $sets[]='condition_status=?'; $params[]=$status; }
    if(array_key_exists('active',$b)){ $sets[]='active=?'; $params[]=!empty($b['active'])?1:0; }
    if(!$sets) json_error('Nada que actualizar.',422); $params[]=$id;
    try { db()->prepare('UPDATE radios SET '.implode(',',$sets).' WHERE id=?')->execute($params); }
    catch(PDOException $e){ if($e->getCode()==='23000') json_error('El código o IMEI ya está registrado.',409); throw $e; }
    json_response(['ok'=>true]);
}
function handle_radios_catalog_delete(int $id): void {
    require_role(['admin']);
    $radio = db()->prepare('SELECT id FROM radios WHERE id=?'); $radio->execute([$id]);
    if (!$radio->fetchColumn()) json_error('No se encontró el radio.', 404);
    $assignments = db()->prepare('SELECT COUNT(*) FROM radio_assignments WHERE radio_id=?'); $assignments->execute([$id]);
    if ((int)$assignments->fetchColumn() > 0) json_error('No se puede eliminar un radio que tiene entregas registradas. Puede desactivarlo desde el botón de estado.', 409);
    db()->prepare('DELETE FROM radios WHERE id=?')->execute([$id]);
    json_response(['ok'=>true]);
}

function handle_radio_context(): void {
    require_role(['admin','supervisor','coordinator']); $date=$_GET['date']??''; $turno=$_GET['turno']??'';
    if(!radio_shift_is_valid($date,$turno)) json_error('Fecha o turno inválido.',422);
    $columns = db()->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='radio_assignments' AND COLUMN_NAME IN ('delivery_group','current_supervisor_id','current_work_date','current_turno')")->fetchAll(PDO::FETCH_COLUMN);
    if (count($columns) < 4) json_error('Actualizacion pendiente: importe migration_grupos_entrega_radios.sql y migration_custodia_radios.sql en phpMyAdmin.', 422);
    $opm=db()->prepare('SELECT a.id, o.id AS opm_id, o.code, o.full_name, a.funcion_1, a.puesto, a.zona_1, a.nave, a.nave_2 FROM opm_assignments a JOIN opms o ON o.id=a.opm_id WHERE a.work_date=? AND a.turno=? ORDER BY o.full_name'); $opm->execute([$date,$turno]);
    $allOpm = db()->prepare('SELECT o.id AS opm_id, o.code, o.full_name, o.puesto, CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS in_turn FROM opms o LEFT JOIN opm_assignments a ON a.opm_id=o.id AND a.work_date=? AND a.turno=? WHERE o.active=1 ORDER BY o.full_name'); $allOpm->execute([$date, $turno]);
    $puestos = db()->query("SELECT DISTINCT puesto FROM opms WHERE active=1 AND puesto IS NOT NULL AND TRIM(puesto)<>'' ORDER BY puesto")->fetchAll(PDO::FETCH_COLUMN);
    $team=db()->prepare("SELECT u.id AS user_id, u.full_name, u.role, a.funcion_1, a.puesto, a.nave, a.nave_2, CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS in_turn FROM users u LEFT JOIN supervisor_assignments a ON a.user_id=u.id AND a.work_date=? AND a.turno=? WHERE u.active=1 AND u.role IN ('supervisor','coordinator') ORDER BY CASE WHEN a.id IS NULL THEN 1 ELSE 0 END, u.full_name"); $team->execute([$date,$turno]);
    $recordSql = radio_records_sql();
    $records=db()->prepare($recordSql . 'WHERE ra.work_date=? AND ra.turno=? ORDER BY ra.created_at DESC, ra.id DESC'); $records->execute([$date,$turno]);
    $relief=db()->prepare($recordSql . 'WHERE COALESCE(ra.current_work_date, ra.work_date)=? AND COALESCE(ra.current_turno, ra.turno)=? AND ra.returned_at IS NULL ORDER BY ra.created_at DESC, ra.id DESC'); $relief->execute([$date,$turno]);
    $locations = db()->query("SELECT DISTINCT location FROM (SELECT location FROM radios WHERE location IS NOT NULL AND location<>'' UNION SELECT location FROM radio_assignments WHERE location IS NOT NULL AND location<>'') locations ORDER BY location")->fetchAll(PDO::FETCH_COLUMN);
    $nextDate = $turno === 'noche' ? date('Y-m-d', strtotime($date . ' +1 day')) : $date; $nextTurno = $turno === 'noche' ? 'dia' : 'noche';
    $next=db()->prepare("SELECT u.id AS user_id, u.full_name, u.role, CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS in_turn FROM users u LEFT JOIN supervisor_assignments a ON a.user_id=u.id AND a.work_date=? AND a.turno=? WHERE u.active=1 AND u.role IN ('supervisor','coordinator') ORDER BY CASE WHEN a.id IS NULL THEN 1 ELSE 0 END, u.full_name"); $next->execute([$nextDate,$nextTurno]);
    json_response(['radios'=>db()->query("SELECT r.id,r.code,r.imei,r.model,r.location, CASE WHEN EXISTS (SELECT 1 FROM radio_assignments ra WHERE ra.radio_id=r.id AND ra.returned_at IS NULL) THEN 0 ELSE 1 END AS available FROM radios r WHERE r.active=1 ORDER BY CAST(r.code AS UNSIGNED), r.code")->fetchAll(), 'opms'=>$opm->fetchAll(), 'all_opms'=>$allOpm->fetchAll(), 'puestos'=>$puestos, 'supervisors'=>$team->fetchAll(), 'next_supervisors'=>$next->fetchAll(), 'next_shift'=>['date'=>$nextDate,'turno'=>$nextTurno], 'records'=>$records->fetchAll(), 'relief_records'=>$relief->fetchAll(), 'locations'=>$locations]);
}
function handle_radio_assignment_create(): void {
    $me=require_role(['admin','supervisor','coordinator']); $b=radio_payload();
    $radioId=(int)($b['radio_id']??0); $supervisorId=(int)($b['supervisor_id']??0); $date=trim($b['work_date']??''); $turno=$b['turno']??''; $condition=$b['condition_status']??'';
    $nave=mb_substr(trim($b['nave']??''),0,150)?:null; $location=mb_substr(trim($b['location']??''),0,150)?:null; $comments=mb_substr(trim($b['comments']??''),0,1000)?:null;
    $opmIds=array_values(array_unique(array_filter(array_map('intval', is_array($b['opm_ids']??null)?$b['opm_ids']:[]))));
    if(!$radioId || !$supervisorId || !radio_shift_is_valid($date,$turno) || !in_array($condition,RADIO_CONDITIONS,true)) json_error('Complete radio, responsable, fecha, turno y estado.',422);
    $radio=db()->prepare('SELECT id FROM radios WHERE id=? AND active=1'); $radio->execute([$radioId]); if(!$radio->fetchColumn()) json_error('El radio seleccionado no está disponible.',422);
    $pending = db()->prepare('SELECT 1 FROM radio_assignments WHERE radio_id=? AND returned_at IS NULL LIMIT 1'); $pending->execute([$radioId]); if ($pending->fetchColumn()) json_error('El radio seleccionado sigue asignado y debe devolverse antes de una nueva entrega.', 409);
    $supervisor=db()->prepare("SELECT 1 FROM supervisor_assignments WHERE user_id=? AND work_date=? AND turno=?"); $supervisor->execute([$supervisorId,$date,$turno]); if(!$supervisor->fetchColumn()) json_error('El responsable no está asignado a este turno.',422);
    if($opmIds){ $marks=implode(',',array_fill(0,count($opmIds),'?')); $valid=db()->prepare("SELECT COUNT(*) FROM opm_assignments WHERE opm_id IN ($marks) AND work_date=? AND turno=?"); $valid->execute([...$opmIds,$date,$turno]); if((int)$valid->fetchColumn()!==count($opmIds)) json_error('Uno de los colaboradores no pertenece a este turno.',422); }
    $photo=save_radio_photo(); $pdo=db(); $pdo->beginTransaction();
    try { $insert=$pdo->prepare('INSERT INTO radio_assignments (radio_id,supervisor_id,work_date,turno,nave,location,condition_status,comments,photo_path,registered_by) VALUES (?,?,?,?,?,?,?,?,?,?)'); $insert->execute([$radioId,$supervisorId,$date,$turno,$nave,$location,$condition,$comments,$photo,$me['id']]); $assignmentId=(int)$pdo->lastInsertId();
      if($opmIds){$link=$pdo->prepare('INSERT INTO radio_assignment_collaborators (radio_assignment_id,opm_id) VALUES (?,?)'); foreach($opmIds as $opmId)$link->execute([$assignmentId,$opmId]);}
      $pdo->commit();
    } catch(Throwable $e){$pdo->rollBack();if($photo&&is_file(__DIR__.'/../../'.$photo))@unlink(__DIR__.'/../../'.$photo);throw $e;}
    json_response(['ok'=>true,'id'=>$assignmentId],201);
}

/** Entrega varias radios a un responsable; un puesto puede recibir más de una radio. */
function handle_radio_batch_assignment_create(): void {
    $me = require_role(['admin', 'coordinator']);
    $b = radio_payload();
    $supervisorId = (int)($b['supervisor_id'] ?? 0);
    $date = trim($b['work_date'] ?? ''); $turno = $b['turno'] ?? '';
    $nave = mb_substr(trim($b['nave'] ?? ''), 0, 150) ?: null;
    $location = mb_substr(trim($b['location'] ?? ''), 0, 150) ?: null;
    $comments = mb_substr(trim($b['comments'] ?? ''), 0, 1000) ?: null;
    $radioIds = array_values(array_unique(array_filter(array_map('intval', is_array($b['radio_ids'] ?? null) ? $b['radio_ids'] : []))));
    $puestos = array_values(array_filter(array_map(fn($value) => mb_substr(trim((string)$value), 0, 150), is_array($b['puestos'] ?? null) ? $b['puestos'] : [])));
    $statuses = is_array($b['condition_statuses'] ?? null) ? $b['condition_statuses'] : [];
    if (!$radioIds || !$supervisorId || !radio_shift_is_valid($date, $turno)) json_error('Seleccione radios, responsable, fecha y turno.', 422);
    if (count($radioIds) !== count($puestos)) json_error('La cantidad de radios debe coincidir con el total asignado entre los puestos.', 422);
    foreach (array_unique($puestos) as $puesto) {
        $registered = db()->prepare('SELECT 1 FROM opms WHERE active=1 AND puesto=? UNION SELECT 1 FROM opm_assignments WHERE work_date=? AND turno=? AND (puesto=? OR funcion_1=?) LIMIT 1');
        $registered->execute([$puesto, $date, $turno, $puesto, $puesto]);
        if (!$registered->fetchColumn()) json_error('Seleccione únicamente puestos registrados.', 422);
    }
    $marks = implode(',', array_fill(0, count($radioIds), '?'));
    $radio = db()->prepare("SELECT COUNT(*) FROM radios WHERE id IN ($marks) AND active=1"); $radio->execute($radioIds);
    if ((int)$radio->fetchColumn() !== count($radioIds)) json_error('Uno de los radios seleccionados no está disponible.', 422);
    $pending = db()->prepare("SELECT COUNT(DISTINCT radio_id) FROM radio_assignments WHERE radio_id IN ($marks) AND returned_at IS NULL"); $pending->execute($radioIds);
    if ((int)$pending->fetchColumn()) json_error('Uno de los radios seleccionados sigue asignado y debe devolverse antes de una nueva entrega.', 409);
    $supervisor = db()->prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('supervisor','coordinator')"); $supervisor->execute([$supervisorId]);
    if (!$supervisor->fetchColumn()) json_error('Seleccione un supervisor o coordinador activo.', 422);
    $conditions = [];
    foreach ($radioIds as $radioId) {
        $condition = $statuses[(string)$radioId] ?? $statuses[$radioId] ?? 'Excelente Estado';
        if (!in_array($condition, RADIO_CONDITIONS, true)) json_error('Seleccione un estado válido para cada radio.', 422);
        $conditions[$radioId] = $condition;
    }
    $photo = save_radio_photo(); $group = bin2hex(random_bytes(16)); $pdo = db(); $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare('INSERT INTO radio_assignments (delivery_group,radio_id,supervisor_id,current_supervisor_id,work_date,current_work_date,turno,current_turno,nave,location,assigned_puesto,condition_status,comments,photo_path,registered_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach ($radioIds as $index => $radioId) $insert->execute([$group, $radioId, $supervisorId, $supervisorId, $date, $date, $turno, $turno, $nave, $location, $puestos[$index], $conditions[$radioId], $comments, $photo, $me['id']]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); if ($photo && is_file(__DIR__ . '/../../' . $photo)) @unlink(__DIR__ . '/../../' . $photo); throw $e; }
    json_response(['ok' => true, 'assigned' => count($radioIds)], 201);
}

function handle_radio_movements(): void {
    $me = require_role(['admin', 'supervisor', 'coordinator']); $b = radio_payload();
    $ids = array_values(array_unique(array_filter(array_map('intval', is_array($b['assignment_ids'] ?? null) ? $b['assignment_ids'] : []))));
    $action = $b['action'] ?? ''; $targetId = (int)($b['target_user_id'] ?? 0); $comments = mb_substr(trim($b['comments'] ?? ''), 0, 1000) ?: null;
    $targetGroup = mb_substr(trim((string)($b['target_group_id'] ?? '')), 0, 40);
    $targetLocation = mb_substr(trim((string)($b['target_location'] ?? '')), 0, 150);
    $targetNave = mb_substr(trim((string)($b['target_nave'] ?? '')), 0, 150);
    if (!$ids || !in_array($action, ['return','reassign','relocate'], true)) json_error('Seleccione radios y la acción a registrar.', 422);
    if ($action === 'return' && $targetId) { $check = db()->prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role='coordinator'"); $check->execute([$targetId]); if (!$check->fetchColumn()) json_error('Seleccione un coordinador activo para recibir la devolución en Tool Room.', 422); }
    $marks = implode(',', array_fill(0, count($ids), '?')); $stmt = db()->prepare("SELECT * FROM radio_assignments WHERE id IN ($marks) AND returned_at IS NULL"); $stmt->execute($ids); $rows = $stmt->fetchAll();
    if (count($rows) !== count($ids)) json_error('Uno de los radios ya fue devuelto o no existe.', 422);
    foreach ($rows as $row) if ($me['role'] === 'supervisor' && (int)($row['current_supervisor_id'] ?: $row['supervisor_id']) !== (int)$me['id']) json_error('Solo puede gestionar radios bajo su responsabilidad.', 403);
    if ($action === 'relocate') {
        if (!$targetGroup || !$targetLocation || !$targetId) json_error('Seleccione una ubicación con responsable activo.', 422);
        $sourceGroup = $rows[0]['delivery_group'] ?: ('legacy-' . $rows[0]['id']);
        if ($targetGroup === $sourceGroup) json_error('Seleccione una ubicación distinta a la actual.', 422);
        $target = db()->prepare("SELECT 1 FROM radio_assignments WHERE returned_at IS NULL AND COALESCE(delivery_group, CONCAT('legacy-', id))=? AND COALESCE(location,'')=? AND COALESCE(nave,'')=? AND COALESCE(current_supervisor_id,supervisor_id)=? LIMIT 1");
        $target->execute([$targetGroup, $targetLocation, $targetNave, $targetId]);
        if (!$target->fetchColumn()) json_error('La ubicación o su responsable actual ya no están disponibles.', 422);
    }
    $photo = save_radio_photo('movement_photo'); $pdo=db(); $pdo->beginTransaction();
    try {
      $movement=$pdo->prepare('INSERT INTO radio_assignment_movements (radio_assignment_id,action,from_user_id,to_user_id,work_date,turno,comments,photo_path) VALUES (?,?,?,?,?,?,?,?)');
      if ($action === 'return') { $update=$pdo->prepare('UPDATE radio_assignments SET returned_at=NOW(), returned_by=?, return_comments=?, return_photo_path=?, current_supervisor_id=NULL, current_work_date=NULL, current_turno=NULL WHERE id=?'); foreach($rows as $row){$from=(int)($row['current_supervisor_id']?:$row['supervisor_id']);$movement->execute([$row['id'],'return',$from,$targetId ?: null,$row['current_work_date']?:$row['work_date'],$row['current_turno']?:$row['turno'],$comments,$photo]);$update->execute([$me['id'],$comments,$photo,$row['id']]);} }
      elseif ($action === 'reassign') { if(!$targetId) json_error('Seleccione al responsable del siguiente turno.',422); $check=$pdo->prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('supervisor','coordinator')"); $check->execute([$targetId]); if(!$check->fetchColumn()) json_error('El supervisor o coordinador seleccionado no existe o está inactivo.',422); foreach($rows as $row){if((int)($row['current_supervisor_id']?:$row['supervisor_id'])===$targetId) json_error('No puede relevar un radio al mismo responsable actual.',422);} $first=$rows[0];$nextDate=$first['current_turno']==='noche'?date('Y-m-d',strtotime($first['current_work_date'].' +1 day')):$first['current_work_date'];$nextTurno=$first['current_turno']==='noche'?'dia':'noche';$update=$pdo->prepare('UPDATE radio_assignments SET current_supervisor_id=?, current_work_date=?, current_turno=? WHERE id=?');foreach($rows as $row){$from=(int)($row['current_supervisor_id']?:$row['supervisor_id']);$movement->execute([$row['id'],'reassign',$from,$targetId,$row['current_work_date']?:$row['work_date'],$row['current_turno']?:$row['turno'],$comments,$photo]);$update->execute([$targetId,$nextDate,$nextTurno,$row['id']]);} }
      else { $update=$pdo->prepare('UPDATE radio_assignments SET delivery_group=?, location=?, nave=?, current_supervisor_id=? WHERE id=?'); foreach($rows as $row){$from=(int)($row['current_supervisor_id']?:$row['supervisor_id']);$movement->execute([$row['id'],'relocate',$from,$targetId,$row['current_work_date']?:$row['work_date'],$row['current_turno']?:$row['turno'],$comments,$photo]);$update->execute([$targetGroup,$targetLocation,$targetNave ?: null,$targetId,$row['id']]);} }
      $pdo->commit();
    } catch(Throwable $e){$pdo->rollBack();throw $e;}
    json_response(['ok'=>true,'moved'=>count($rows)]);
}

function handle_radio_assignment_collaborator(int $id): void {
    $me = require_role(['admin', 'supervisor', 'coordinator']); $b = json_body(); $opmId = (int)($b['opm_id'] ?? 0); $puesto = mb_substr(trim((string)($b['puesto'] ?? '')), 0, 150);
    $stmt = db()->prepare('SELECT * FROM radio_assignments WHERE id=?'); $stmt->execute([$id]); $record = $stmt->fetch();
    if (!$record) json_error('No se encontró la entrega del radio.', 404);
    if ($me['role'] === 'supervisor' && (int)($record['current_supervisor_id'] ?: $record['supervisor_id']) !== (int)$me['id']) json_error('Solo puede gestionar radios bajo su responsabilidad.', 403);
    $puesto = $puesto ?: $record['assigned_puesto'];
    if (!$opmId && $puesto === $record['assigned_puesto']) { json_response(['ok' => true]); return; }
    $validPuesto = db()->prepare('SELECT 1 FROM opms WHERE active=1 AND puesto=? LIMIT 1'); $validPuesto->execute([$puesto]);
    if (!$validPuesto->fetchColumn()) json_error('Seleccione un puesto registrado.', 422);
    if ($puesto !== $record['assigned_puesto']) {
        db()->prepare('UPDATE radio_assignments SET assigned_puesto=? WHERE id=?')->execute([$puesto, $id]);
        db()->prepare('DELETE FROM radio_assignment_collaborators WHERE radio_assignment_id=?')->execute([$id]);
    }
    if (!$opmId) { json_response(['ok' => true]); return; }
    $opm = db()->prepare('SELECT 1 FROM opms WHERE id=? AND active=1 AND puesto=?'); $opm->execute([$opmId, $puesto]);
    if (!$opm->fetchColumn()) json_error('El colaborador debe pertenecer al puesto seleccionado.', 422);
    $group = $record['delivery_group'] ?: ('legacy-' . $record['id']);
    $used = db()->prepare("SELECT 1 FROM radio_assignment_collaborators rac JOIN radio_assignments ra ON ra.id=rac.radio_assignment_id WHERE COALESCE(ra.delivery_group, CONCAT('legacy-',ra.id))=? AND rac.opm_id=? AND rac.radio_assignment_id<>?"); $used->execute([$group, $opmId, $id]);
    if ($used->fetchColumn()) json_error('Este colaborador ya recibió otra radio de esta entrega.', 422);
    db()->prepare('DELETE FROM radio_assignment_collaborators WHERE radio_assignment_id=?')->execute([$id]);
    db()->prepare('INSERT INTO radio_assignment_collaborators (radio_assignment_id,opm_id) VALUES (?,?)')->execute([$id, $opmId]);
    json_response(['ok' => true]);
}

function radio_assignment_for_update(int $id, array $me): array {
    $stmt = db()->prepare('SELECT * FROM radio_assignments WHERE id=?'); $stmt->execute([$id]); $record = $stmt->fetch();
    if (!$record) json_error('No se encontró la entrega de radio.', 404);
    if (!in_array($me['role'], ['admin', 'coordinator'], true)) json_error('Solo administradores y coordinadores pueden modificar esta entrega.', 403);
    return $record;
}
function radio_assignment_update_values(array $b, array $record): array {
    $supervisorId = (int)($b['supervisor_id'] ?? 0); $date = trim($b['work_date'] ?? ''); $turno = $b['turno'] ?? '';
    $nave = mb_substr(trim($b['nave'] ?? ''), 0, 150) ?: null; $location = mb_substr(trim($b['location'] ?? ''), 0, 150) ?: null;
    $comments = mb_substr(trim($b['comments'] ?? ''), 0, 1000) ?: null;
    $puesto = mb_substr(trim((string)((is_array($b['puestos'] ?? null) ? ($b['puestos'][0] ?? '') : ''))), 0, 150);
    $statuses = is_array($b['condition_statuses'] ?? null) ? $b['condition_statuses'] : [];
    $condition = $statuses[(string)$record['radio_id']] ?? $statuses[$record['radio_id']] ?? $record['condition_status'];
    if (!$supervisorId || !radio_shift_is_valid($date, $turno) || !$puesto || !in_array($condition, RADIO_CONDITIONS, true)) json_error('Complete responsable, puesto, fecha, turno y estado del radio.', 422);
    $supervisor = db()->prepare('SELECT 1 FROM supervisor_assignments WHERE user_id=? AND work_date=? AND turno=?'); $supervisor->execute([$supervisorId, $date, $turno]);
    if (!$supervisor->fetchColumn()) json_error('El responsable no está asignado a este turno.', 422);
    $valid = db()->prepare("SELECT 1 FROM opm_assignments WHERE work_date=? AND turno=? AND puesto=? LIMIT 1"); $valid->execute([$date, $turno, $puesto]);
    if (!$valid->fetchColumn()) json_error('El puesto no pertenece a este turno.', 422);
    return [$supervisorId, $nave, $location, $puesto, $condition, $comments];
}
function handle_radio_assignment_update(int $id): void {
    $me = require_role(['admin', 'coordinator']); $record = radio_assignment_for_update($id, $me); $b = radio_payload();
    [$supervisorId, $nave, $location, $puesto, $condition, $comments] = radio_assignment_update_values($b, $record);
    $photo = save_radio_photo(); $photoPath = $photo ?: $record['photo_path'];
    db()->prepare('UPDATE radio_assignments SET supervisor_id=?, nave=?, location=?, assigned_puesto=?, condition_status=?, comments=?, photo_path=? WHERE id=?')->execute([$supervisorId, $nave, $location, $puesto, $condition, $comments, $photoPath, $id]);
    if ($photo && $record['photo_path'] && is_file(__DIR__ . '/../../' . $record['photo_path'])) @unlink(__DIR__ . '/../../' . $record['photo_path']);
    json_response(['ok' => true]);
}
/** Actualiza una entrega agrupada sin dividir sus radios en registros separados. */
function handle_radio_assignment_group_update(): void {
    $me = require_role(['admin', 'coordinator']); $b = radio_payload();
    $group = trim((string)($b['group_id'] ?? ''));
    $radioIds = array_values(array_unique(array_filter(array_map('intval', is_array($b['radio_ids'] ?? null) ? $b['radio_ids'] : []))));
    $puestos = array_values(array_filter(array_map(fn($value) => mb_substr(trim((string)$value), 0, 150), is_array($b['puestos'] ?? null) ? $b['puestos'] : [])));
    $statuses = is_array($b['condition_statuses'] ?? null) ? $b['condition_statuses'] : [];
    $supervisorId = (int)($b['supervisor_id'] ?? 0); $date = trim($b['work_date'] ?? ''); $turno = $b['turno'] ?? '';
    $nave = mb_substr(trim($b['nave'] ?? ''), 0, 150) ?: null; $location = mb_substr(trim($b['location'] ?? ''), 0, 150) ?: null;
    $comments = mb_substr(trim($b['comments'] ?? ''), 0, 1000) ?: null;
    if (!$group || !$radioIds || !$supervisorId || !radio_shift_is_valid($date, $turno)) json_error('Complete la entrega, responsable, fecha y turno.', 422);
    if (count($radioIds) !== count($puestos)) json_error('La cantidad de radios debe coincidir con el total asignado entre los puestos.', 422);
    $stmt = db()->prepare('SELECT * FROM radio_assignments WHERE delivery_group=? ORDER BY id'); $stmt->execute([$group]); $records = $stmt->fetchAll();
    if (!$records) json_error('No se encontró la entrega agrupada.', 404);
    foreach ($records as $record) radio_assignment_for_update((int)$record['id'], $me);
    $recordsByRadio = [];
    foreach ($records as $record) $recordsByRadio[(int)$record['radio_id']] = $record;
    $storedRadioIds = array_keys($recordsByRadio); $requestedRadioIds = $radioIds;
    $addedRadioIds = array_values(array_diff($requestedRadioIds, $storedRadioIds));
    $removedRadioIds = array_values(array_diff($storedRadioIds, $requestedRadioIds));
    if (($addedRadioIds || $removedRadioIds) && array_filter($records, fn($record) => $record['returned_at'])) json_error('No se pueden agregar o quitar radios de una entrega que ya tiene devoluciones registradas.', 409);
    $supervisor = db()->prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('supervisor','coordinator')"); $supervisor->execute([$supervisorId]);
    if (!$supervisor->fetchColumn()) json_error('Seleccione un supervisor o coordinador activo.', 422);
    foreach ($radioIds as $radioId) if (!in_array($statuses[(string)$radioId] ?? $statuses[$radioId] ?? '', RADIO_CONDITIONS, true)) json_error('Seleccione un estado válido para cada radio.', 422);
    if ($addedRadioIds) {
        $marks = implode(',', array_fill(0, count($addedRadioIds), '?'));
        $available = db()->prepare("SELECT COUNT(*) FROM radios WHERE id IN ($marks) AND active=1"); $available->execute($addedRadioIds);
        if ((int)$available->fetchColumn() !== count($addedRadioIds)) json_error('Uno de los radios agregados no está disponible.', 422);
        $pending = db()->prepare("SELECT COUNT(DISTINCT radio_id) FROM radio_assignments WHERE radio_id IN ($marks) AND returned_at IS NULL AND COALESCE(delivery_group, '')<>?"); $pending->execute([...$addedRadioIds, $group]);
        if ((int)$pending->fetchColumn()) json_error('Uno de los radios agregados sigue asignado y debe devolverse antes de agregarlo.', 409);
    }
    $photo = save_radio_photo(); $oldPhotos = array_values(array_unique(array_filter(array_column($records, 'photo_path')))); $pdo = db(); $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE radio_assignments SET supervisor_id=?, current_supervisor_id=CASE WHEN current_supervisor_id=? THEN ? ELSE current_supervisor_id END, nave=?, location=?, assigned_puesto=?, condition_status=?, comments=?, photo_path=? WHERE id=?');
        $insert = $pdo->prepare('INSERT INTO radio_assignments (delivery_group,radio_id,supervisor_id,current_supervisor_id,work_date,current_work_date,turno,current_turno,nave,location,assigned_puesto,condition_status,comments,photo_path,registered_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        if ($removedRadioIds) { $marks = implode(',', array_fill(0, count($removedRadioIds), '?')); $delete = $pdo->prepare("DELETE FROM radio_assignments WHERE delivery_group=? AND radio_id IN ($marks)"); $delete->execute([$group, ...$removedRadioIds]); }
        foreach ($radioIds as $index => $radioId) {
            $record = $recordsByRadio[$radioId] ?? null;
            $condition = $statuses[(string)$radioId] ?? $statuses[$radioId];
            if ($record) {
                $photoPath = $photo ?: $record['photo_path'];
                $update->execute([$supervisorId, $record['supervisor_id'], $supervisorId, $nave, $location, $puestos[$index], $condition, $comments, $photoPath, $record['id']]);
            } else $insert->execute([$group, $radioId, $supervisorId, $supervisorId, $date, $date, $turno, $turno, $nave, $location, $puestos[$index], $condition, $comments, $photo, $me['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); if ($photo && is_file(__DIR__ . '/../../' . $photo)) @unlink(__DIR__ . '/../../' . $photo); throw $e; }
    if ($photo) foreach ($oldPhotos as $oldPhoto) if ($oldPhoto !== $photo && is_file(__DIR__ . '/../../' . $oldPhoto)) @unlink(__DIR__ . '/../../' . $oldPhoto);
    json_response(['ok' => true, 'updated' => count($radioIds)]);
}
function handle_radio_assignment_delete(int $id): void {
    $me = require_role(['admin', 'coordinator']); $record = radio_assignment_for_update($id, $me);
    db()->prepare('DELETE FROM radio_assignments WHERE id=?')->execute([$id]);
    foreach (['photo_path', 'return_photo_path'] as $field) if ($record[$field] && is_file(__DIR__ . '/../../' . $record[$field])) @unlink(__DIR__ . '/../../' . $record[$field]);
    json_response(['ok' => true]);
}

/** Devuelve todas las radios pendientes de un responsable para la fecha y turno indicados. */
function handle_radio_return(): void {
    $me = require_role(['admin', 'supervisor', 'coordinator']); $b = radio_payload();
    $supervisorId = (int)($b['supervisor_id'] ?? 0); $date = trim($b['work_date'] ?? ''); $turno = $b['turno'] ?? '';
    $comments = mb_substr(trim($b['comments'] ?? ''), 0, 1000) ?: null;
    if (!$supervisorId || !radio_shift_is_valid($date, $turno)) json_error('Seleccione responsable, fecha y turno válidos.', 422);
    if ($me['role'] !== 'admin' && $supervisorId !== (int)$me['id']) json_error('Solo puede registrar la devolución de sus propios radios.', 403);
    $pending = db()->prepare('SELECT COUNT(*) FROM radio_assignments WHERE supervisor_id=? AND work_date=? AND turno=? AND returned_at IS NULL'); $pending->execute([$supervisorId, $date, $turno]);
    $total = (int)$pending->fetchColumn(); if (!$total) json_error('No hay radios pendientes de devolución para este responsable.', 422);
    $photo = save_radio_photo('return_photo');
    db()->prepare('UPDATE radio_assignments SET returned_at=NOW(), returned_by=?, return_comments=?, return_photo_path=? WHERE supervisor_id=? AND work_date=? AND turno=? AND returned_at IS NULL')->execute([$me['id'], $comments, $photo, $supervisorId, $date, $turno]);
    json_response(['ok' => true, 'returned' => $total]);
}

/**
 * Visión general de todas las entregas con su último estado (Entregado,
 * Pendiente, Devuelto a Tool Room o Reasignado) y la fecha de su última
 * actualización. Se usa en los filtros "Pendientes" y "Completadas".
 */
function radio_overview(): array {
    $assignments = db()->query(radio_records_sql() . 'ORDER BY ra.work_date DESC, ra.id DESC')->fetchAll();
    if (!$assignments) return [];
    $marks = implode(',', array_fill(0, count($assignments), '?'));
    $ids = array_map('intval', array_column($assignments, 'id'));
    $movement = db()->prepare("SELECT m.*, from_u.full_name AS from_name, to_u.full_name AS to_name FROM radio_assignment_movements m JOIN users from_u ON from_u.id=m.from_user_id LEFT JOIN users to_u ON to_u.id=m.to_user_id WHERE m.radio_assignment_id IN ($marks) ORDER BY m.radio_assignment_id, m.created_at ASC, m.id ASC");
    $movement->execute($ids);
    $lastByAssignment = [];
    foreach ($movement->fetchAll() as $row) $lastByAssignment[(int)$row['radio_assignment_id']] = $row;
    foreach ($assignments as &$record) {
        $record['state'] = 'Entregado';
        $record['state_at'] = $record['created_at'] ?: $record['work_date'];
        $last = $lastByAssignment[(int)$record['id']] ?? null;
        if ($last) {
            $record['state_at'] = $last['created_at'];
            $record['state'] = $last['action'] === 'return' ? 'Devuelto a Tool Room' : 'Reasignado';
        } elseif ($record['returned_at']) {
            $record['state'] = 'Devuelto a Tool Room';
            $record['state_at'] = $record['returned_at'];
        } else {
            $record['state'] = 'Pendiente';
        }
    }
    unset($record);
    return $assignments;
}
function handle_radio_overview(): void {
    require_role(['admin', 'supervisor', 'coordinator']);
    json_response(['records' => radio_overview()]);
}

/** Entregas registradas en un rango de fechas (para reportes semanal / mensual). */
function handle_radio_reports(): void {
    require_role(['admin', 'coordinator']);
    $from = $_GET['from'] ?? ''; $to = $_GET['to'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) json_error('Rango de fechas inválido.', 422);
    if (strcmp($from, $to) > 0) json_error('La fecha inicial no puede ser posterior a la final.', 422);
    $stmt = db()->prepare(radio_records_sql() . 'WHERE ra.work_date BETWEEN ? AND ? ORDER BY ra.work_date DESC, ra.turno ASC, ra.created_at DESC, ra.id DESC');
    $stmt->execute([$from, $to]);
    json_response(['records' => $stmt->fetchAll()]);
}

/**
 * Reporte diario de trazabilidad por fecha y turno.
 *
 * Incluye cada radio con su ÚLTIMO movimiento registrado dentro del turno
 * seleccionado (entrega, devolución o reasignación) y el estado final:
 * código, modelo/IMEI, estado, tipo de movimiento, fecha/hora, responsable
 * anterior y actual, ubicación final y comentarios.
 *
 * Reasignaciones registradas con la acción "Reasignar al siguiente turno" se
 * reportan como "Reasignado" (sin devolución al Tool Room), conservando la
 * trazabilidad del responsable anterior hacia el nuevo responsable.
 */
function radio_daily_report(string $date, string $turno): array {
    // El reporte incluye tanto los movimientos del turno como las radios que siguen
    // bajo custodia en él, aunque su entrega original haya sido anterior.
    $scope = db()->prepare('SELECT DISTINCT ra.id FROM radio_assignments ra LEFT JOIN radio_assignment_movements m ON m.radio_assignment_id=ra.id AND m.work_date=? AND m.turno=? WHERE (ra.work_date=? AND ra.turno=?) OR m.id IS NOT NULL OR (ra.returned_at IS NULL AND COALESCE(ra.current_work_date,ra.work_date)=? AND COALESCE(ra.current_turno,ra.turno)=?)');
    $scope->execute([$date, $turno, $date, $turno, $date, $turno]);
    $ids = array_values(array_map('intval', $scope->fetchAll(PDO::FETCH_COLUMN)));
    if (!$ids) return [];
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare(radio_records_sql() . "WHERE ra.id IN ($marks) ORDER BY r.code ASC");
    $stmt->execute($ids);
    $records = $stmt->fetchAll();
    // Se toma el último movimiento real de cada radio (devolución o reasignación),
    // sin filtrar por el turno en curso, para reflejar reasignaciones hechas antes
    // y las devoluciones de este turno aunque luego se haya reasignado.
    $movement = db()->prepare("SELECT m.*, from_u.full_name AS from_name, to_u.full_name AS to_name FROM radio_assignment_movements m JOIN users from_u ON from_u.id=m.from_user_id LEFT JOIN users to_u ON to_u.id=m.to_user_id WHERE m.radio_assignment_id IN ($marks) ORDER BY m.radio_assignment_id, m.created_at ASC, m.id ASC");
    $movement->execute($ids);
    $lastByAssignment = [];
    foreach ($movement->fetchAll() as $row) $lastByAssignment[(int)$row['radio_assignment_id']] = $row;
    foreach ($records as &$record) {
        $record['previous_supervisor_id'] = null;
        $record['previous_supervisor_name'] = 'Tool Room';
        $record['current_supervisor_name'] = $record['current_supervisor_name'] ?: $record['supervisor_name'];
        $record['movement'] = ($record['returned_at'] === null && $record['work_date'] !== $date)
            ? 'Pendiente en custodia'
            : 'Entregado';
        $record['movement_at'] = $record['created_at'];
        $record['movement_comments'] = $record['comments'];
        $record['returned_by_name'] = null;
        $record['movement_photo'] = $record['photo_path'];
        $record['final_location'] = trim(implode(' · ', array_filter([$record['location'], $record['nave']]))) ?: 'TOOLROOM';
        $last = $lastByAssignment[(int)$record['id']] ?? null;
        if ($last) {
            $record['movement_at'] = $last['created_at'];
            $record['movement_comments'] = $last['comments'];
            $record['movement_photo'] = $last['photo_path'];
            $record['previous_supervisor_id'] = (int)$last['from_user_id'];
            $record['previous_supervisor_name'] = $last['from_name'];
            if ($last['action'] === 'return') {
                $record['movement'] = 'Devuelto a Tool Room';
                $record['current_supervisor_id'] = $last['to_user_id'] ? (int)$last['to_user_id'] : null;
                $record['current_supervisor_name'] = $last['to_name'] ?: 'Tool Room';
                $record['returned_by_name'] = $last['from_name'];
                $record['final_location'] = 'TOOLROOM';
            } elseif ($last['action'] === 'relocate') {
                $record['movement'] = 'Reasignación a otra ubicación';
                $record['current_supervisor_id'] = $last['to_user_id'] ? (int)$last['to_user_id'] : $record['current_supervisor_id'];
                $record['current_supervisor_name'] = $last['to_name'] ?: $record['current_supervisor_name'];
            } else {
                $record['movement'] = 'Relevado al siguiente turno';
                $record['current_supervisor_id'] = $last['to_user_id'] ? (int)$last['to_user_id'] : $record['current_supervisor_id'];
                $record['current_supervisor_name'] = $last['to_name'] ?: $record['current_supervisor_name'];
            }
        } elseif ($record['returned_at']) {
            $record['movement'] = 'Devuelto a Tool Room';
            $record['movement_at'] = $record['returned_at'];
            $record['movement_comments'] = $record['return_comments'];
            $record['movement_photo'] = $record['return_photo_path'];
            $record['previous_supervisor_id'] = $record['current_supervisor_id'] ? (int)$record['current_supervisor_id'] : (int)$record['supervisor_id'];
            $record['previous_supervisor_name'] = $record['current_supervisor_name'] ?: $record['supervisor_name'];
            $record['current_supervisor_id'] = null;
            $record['current_supervisor_name'] = 'Tool Room';
            $record['final_location'] = 'TOOLROOM';
        }
    }
    unset($record);
    return $records;
}
function handle_radio_daily_report(): void {
    require_role(['admin', 'supervisor', 'coordinator']);
    $date = $_GET['date'] ?? ''; $turno = $_GET['turno'] ?? '';
    if (!radio_shift_is_valid($date, $turno)) json_error('Fecha o turno inválido.', 422);
    $total = (int)db()->query("SELECT COUNT(*) FROM radios WHERE active=1")->fetchColumn();
    $inOperations = (int)db()->query("SELECT COUNT(DISTINCT radio_id) FROM radio_assignments WHERE returned_at IS NULL")->fetchColumn();
    json_response(['records' => radio_daily_report($date, $turno), 'total_radios' => $total, 'in_operations' => $inOperations]);
}
