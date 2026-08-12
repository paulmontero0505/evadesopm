<?php
// ============================================================
//  Lector/escritor mínimo de .xlsx (sin dependencias externas).
//  Extrae pares { code, name } de la hoja de colaboradores.
//  Un .xlsx es un ZIP con XML: shared strings + hojas.
// ============================================================

/** Escapa texto para usar dentro de un nodo XML. */
function xlsx_esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

/**
 * Genera un .xlsx mínimo con los encabezados y la fila de ejemplo dados, para que el
 * admin descargue la plantilla exacta que espera la importación masiva correspondiente
 * (los encabezados los reconoce xlsx_read_opms(), reutilizado para OPMs y Supervisores).
 * Devuelve los bytes del archivo.
 */
function xlsx_build_template(string $sheetName, array $headers, array $example, ?array $rows = null): string
{
    $cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    $cellsXml = function (array $vals, int $rowNum) use ($cols): string {
        $cells = '';
        foreach ($vals as $i => $v) {
            $ref = $cols[$i] . $rowNum;
            $cells .= '<c r="' . $ref . '" t="inlineStr"><is><t>' . xlsx_esc((string)$v) . '</t></is></c>';
        }
        return '<row r="' . $rowNum . '">' . $cells . '</row>';
    };

    $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<sheetData>' . $cellsXml($headers, 1) . implode('', array_map(fn($row, $index) => $cellsXml($row, $index + 2), $rows ?? [$example], array_keys($rows ?? [$example]))) . '</sheetData>'
        . '</worksheet>';

    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        . '</Types>';

    $rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';

    $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheets><sheet name="' . xlsx_esc($sheetName) . '" sheetId="1" r:id="rId1"/></sheets>'
        . '</workbook>';

    $workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        . '</Relationships>';

    $tmp = tempnam(sys_get_temp_dir(), 'xlsxtpl');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    $zip->addFromString('[Content_Types].xml', $contentTypes);
    $zip->addFromString('_rels/.rels', $rootRels);
    $zip->addFromString('xl/workbook.xml', $workbook);
    $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
    $zip->close();

    $bytes = file_get_contents($tmp);
    unlink($tmp);
    return $bytes;
}

/** Plantilla de carga masiva de colaboradores OPM. */
function xlsx_build_opms_template_legacy(): string
{
    return xlsx_build_template(
        'OPMS',
        ['CÓDIGO', 'DNI', 'FECHA DE INGRESO', 'NOMBRE COMPLETO', 'PUESTO', 'TEAM'],
        ['0000116', '12345678', '2024-01-15', 'OLIVOS TOLENTINO CESAR JOSE', 'Operario Multipropósito', 'Turno Día']
    );
}

/** Plantilla de carga masiva de usuarios Supervisores (el DNI será su usuario y contraseña). */
function xlsx_build_opms_template(): string
{
    return xlsx_build_assignments_template(
        'COLABORADORES',
        ['CODIGO', 'NOMBRES COMPLETOS', 'CARGO', 'FECHA DE INGRESO', 'N° DOCUMENTO', 'FECHA DE NACIMIENTO', 'TELEFONO', 'MAIL PERSONAL', 'TEAM', 'STATUS'],
        [16, 34, 34, 19, 18, 22, 16, 32, 18, 14]
    );
}

/** Exporta el catálogo actual de colaboradores, incluido su estado laboral. */
function xlsx_build_opms_export(array $opms): string
{
    $headers = ['CODIGO', 'NOMBRES COMPLETOS', 'CARGO', 'FECHA DE INGRESO', 'N° DOCUMENTO', 'FECHA DE NACIMIENTO', 'TELEFONO', 'MAIL PERSONAL', 'TEAM', 'STATUS'];
    $rows = array_map(fn($opm) => [
        $opm['code'], $opm['full_name'], $opm['puesto'] ?? '', $opm['fecha_ingreso'] ?? '', $opm['dni'] ?? '',
        $opm['fecha_nacimiento'] ?? '', $opm['telefono'] ?? '', $opm['email_personal'] ?? '', $opm['team'] ?? '',
        !empty($opm['active']) ? 'ACTIVO' : 'CESADO',
    ], $opms);
    return xlsx_build_assignments_template('COLABORADORES', $headers, [16, 34, 34, 19, 18, 22, 16, 32, 18, 14], $rows);
}

function xlsx_build_supervisors_template(): string
{
    return xlsx_build_template(
        'SUPERVISORES',
        ['COD', 'DNI', 'F. INGRESO', 'COLABORADOR', 'PUESTO', 'TEAM'],
        ['0000105', '75985816', '2024-08-01', 'SAEZ UBETA XIMENA NICOLE', 'SUPERVISOR DE OPERACIONES', 'ADM']
    );
}

/** Plantilla de asignación de funciones OPM por fecha. El turno se elige al importar. */
function xlsx_build_assignments_template_legacy(): string
{
    return xlsx_build_template(
        'ASIGNACION',
        ['APELLIDOS Y NOMBRES', 'DESIGNADO FUNCIÓN 1', 'DESIGNADO FUNCIÓN 2', 'ZONA 1', 'PUESTO', 'NAVE', 'NAVE 2'],
        ['APELLIDOS Y NOMBRES DEL OPM', 'FUNCIÓN PRINCIPAL', '', 'ZONA', 'OPERARIO MULTIPROPÓSITO', '', '']
    );
}

/** Plantilla de asignaciÃ³n con encabezados y filtros listos para completar. */
function xlsx_build_assignments_template(string $sheetName = 'ASIGNACION', ?array $customHeaders = null, ?array $customWidths = null, ?array $dataRows = null): string
{
    $headers = ['APELLIDOS Y NOMBRES', 'FUNCIÓN 1', 'FUNCIÓN 2', 'ZONA 1', 'PUESTO', 'NAVE', 'NAVE 2'];
    $headers = $customHeaders ?: $headers;
    $cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    $widths = $customWidths ?: [31, 24, 24, 20, 22, 20, 20];

    $headerCells = '';
    foreach ($headers as $i => $header) {
        $headerCells .= '<c r="' . $cols[$i] . '1" s="1" t="inlineStr"><is><t>'
            . xlsx_esc($header) . '</t></is></c>';
    }
    $columnsXml = '';
    foreach ($widths as $i => $width) {
        $position = $i + 1;
        $columnsXml .= '<col min="' . $position . '" max="' . $position . '" width="' . $width . '" customWidth="1"/>';
    }

    $dataCells = '';
    foreach ($dataRows ?? [] as $rowIndex => $row) {
        $cells = '';
        foreach ($headers as $columnIndex => $_header) {
            $value = $row[$columnIndex] ?? '';
            $cells .= '<c r="' . $cols[$columnIndex] . ($rowIndex + 2) . '" t="inlineStr"><is><t>' . xlsx_esc((string)$value) . '</t></is></c>';
        }
        $dataCells .= '<row r="' . ($rowIndex + 2) . '">' . $cells . '</row>';
    }

    $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>'
        . '<sheetFormatPr defaultRowHeight="15"/>'
        . '<cols>' . $columnsXml . '</cols>'
        . '<sheetData><row r="1" ht="21" customHeight="1">' . $headerCells . '</row>' . $dataCells . '</sheetData>'
        . '<autoFilter ref="A1:' . $cols[count($headers) - 1] . '1000"/>'
        . '</worksheet>';

    $stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><b/></font></fonts>'
        . '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf></cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        . '</styleSheet>';

    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . '</Types>';
    $rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';
    $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheets><sheet name="' . xlsx_esc($sheetName) . '" sheetId="1" r:id="rId1"/></sheets></workbook>';
    $workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . '</Relationships>';

    $tmp = tempnam(sys_get_temp_dir(), 'xlsxassign');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    $zip->addFromString('[Content_Types].xml', $contentTypes);
    $zip->addFromString('_rels/.rels', $rootRels);
    $zip->addFromString('xl/workbook.xml', $workbook);
    $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
    $zip->addFromString('xl/styles.xml', $stylesXml);
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
    $zip->close();

    $bytes = file_get_contents($tmp);
    unlink($tmp);
    return $bytes;
}

/** Plantilla de inventario de radios con el mismo encabezado negro y filtros. */
function xlsx_build_radios_template(): string
{
    return xlsx_build_assignments_template(
        'RADIOS',
        ['CODIGO', 'IMEI', 'MODELO', 'UBICACIÓN'],
        [20, 24, 28, 28]
    );
}

function xlsx_build_radio_locations_report(array $radios): string
{
    $headers = ['CODIGO', 'IMEI', 'MODELO', 'ESTADO', 'ULTIMA UBICACION', 'NAVE', 'ASIGNADO A', 'RESPONSABLE', 'EN OPERACIONES', 'ACTIVO'];
    $rows = array_map(fn($radio) => [$radio['code'], $radio['imei'], $radio['model'], $radio['condition_status'] ?? 'Excelente Estado', $radio['last_location'] ?? $radio['location'] ?? '', $radio['last_nave'] ?? '', $radio['collaborator_name'] ?? '', $radio['custodian_name'] ?? '', !empty($radio['in_operations']) ? 'SI' : 'NO', !empty($radio['active']) ? 'SI' : 'NO'], $radios);
    if (!$rows) $rows = [array_fill(0, count($headers), '')];
    return xlsx_build_template('UBICACIONES', $headers, $rows[0], $rows);
}

function xlsx_parse_date_value(string $raw): ?string
{
    $raw = trim($raw);
    if ($raw === '') return null;
    if (is_numeric($raw)) return date('Y-m-d', (((int)$raw) - 25569) * 86400);
    foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
        $date = DateTime::createFromFormat('!' . $format, $raw);
        if ($date && $date->format($format) === $raw) return $date->format('Y-m-d');
    }
    return null;
}

function xlsx_read_opms(string $path): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('La extensión ZIP de PHP no está disponible en el servidor.');
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('No se pudo abrir el archivo Excel.');
    }

    // 1) Cadenas compartidas (shared strings), indexadas por posición.
    $shared = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml !== false && preg_match_all('/<(?:\w+:)?si\b[^>]*>(.*?)<\/(?:\w+:)?si>/s', $ssXml, $m)) {
        foreach ($m[1] as $si) {
            $text = '';
            if (preg_match_all('/<(?:\w+:)?t\b[^>]*>(.*?)<\/(?:\w+:)?t>/s', $si, $tm)) {
                $text = implode('', $tm[1]);
            }
            $shared[] = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
        }
    }

    // 2) Localizar la hoja "OPMS" (o la primera) vía workbook + rels.
    $sheetTarget = 'xl/worksheets/sheet1.xml';
    $workbook = $zip->getFromName('xl/workbook.xml');
    $rels     = $zip->getFromName('xl/_rels/workbook.xml.rels');
    if ($workbook !== false && $rels !== false &&
        preg_match_all('/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/', $workbook, $sm, PREG_SET_ORDER)) {
        $rid = null;
        foreach ($sm as $s) { if (stripos($s[1], 'OPMS') !== false) { $rid = $s[2]; break; } }
        if ($rid === null) $rid = $sm[0][2] ?? null;
        if ($rid && preg_match('/<Relationship\b[^>]*Id="' . preg_quote($rid, '/') . '"[^>]*Target="([^"]*)"/', $rels, $rmatch)) {
            $t = ltrim($rmatch[1], '/');
            $sheetTarget = strpos($t, 'xl/') === 0 ? $t : 'xl/' . $t;
        }
    }

    $sheet = $zip->getFromName($sheetTarget);
    $zip->close();
    if ($sheet === false) {
        throw new RuntimeException('No se encontró la hoja de datos en el Excel.');
    }

    // 3) Parsear filas y celdas.
    $rows = [];
    if (preg_match_all('/<(?:\w+:)?row\b[^>]*>(.*?)<\/(?:\w+:)?row>/s', $sheet, $rm)) {
        foreach ($rm[1] as $rowXml) {
            $cells = [];
            if (preg_match_all('/<(?:\w+:)?c\b([^>]*)>(.*?)<\/(?:\w+:)?c>/s', $rowXml, $cm, PREG_SET_ORDER)) {
                foreach ($cm as $c) {
                    $attr = $c[1]; $inner = $c[2];
                    if (!preg_match('/\br="([A-Z]+)\d+"/', $attr, $rc)) continue;
                    $col  = $rc[1];
                    $type = preg_match('/\bt="([^"]+)"/', $attr, $tm) ? $tm[1] : '';
                    $val  = '';
                    if ($type === 'inlineStr') {
                        if (preg_match_all('/<(?:\w+:)?t\b[^>]*>(.*?)<\/(?:\w+:)?t>/s', $inner, $im)) $val = implode('', $im[1]);
                    } elseif (preg_match('/<(?:\w+:)?v>(.*?)<\/(?:\w+:)?v>/s', $inner, $vm)) {
                        $val = ($type === 's') ? ($shared[(int)$vm[1]] ?? '') : $vm[1];
                    }
                    $cells[$col] = trim(html_entity_decode($val, ENT_QUOTES | ENT_XML1, 'UTF-8'));
                }
            }
            $rows[] = $cells;
        }
    }
    if (!$rows) return [];

    // 4) Detectar columnas por encabezado: código, DNI, fecha de ingreso, nombre, puesto, equipo.
    $codeCol = null; $dniCol = null; $ingresoCol = null; $nacimientoCol = null; $nameCol = null;
    $puestoCol = null; $telefonoCol = null; $emailCol = null; $teamCol = null;
    foreach ($rows[0] as $col => $txt) {
        $u = mb_strtoupper($txt);
        if ($codeCol   === null && strpos($u, 'COD') !== false) $codeCol = $col;
        if ($dniCol    === null && (strpos($u, 'DNI') !== false || strpos($u, 'DOCUMENT') !== false)) $dniCol = $col;
        if ($nacimientoCol === null && strpos($u, 'NACIMIENTO') !== false) $nacimientoCol = $col;
        if ($ingresoCol === null && strpos($u, 'INGRESO') !== false) $ingresoCol = $col;
        if ($nameCol   === null && (strpos($u, 'COLAB') !== false || strpos($u, 'NOMBRE') !== false)) $nameCol = $col;
        if ($puestoCol === null && (strpos($u, 'PUESTO') !== false || strpos($u, 'CARGO') !== false)) $puestoCol = $col;
        if ($telefonoCol === null && strpos($u, 'TELEF') !== false) $telefonoCol = $col;
        if ($emailCol === null && (strpos($u, 'MAIL') !== false || strpos($u, 'CORREO') !== false)) $emailCol = $col;
        if ($teamCol   === null && strpos($u, 'TEAM') !== false) $teamCol = $col;
    }
    if ($codeCol === null) $codeCol = 'A';
    if ($nameCol === null) $nameCol = 'D';

    // 5) Extraer datos desde la segunda fila.
    $out = [];
    for ($i = 1, $n = count($rows); $i < $n; $i++) {
        $code = $rows[$i][$codeCol] ?? '';
        $name = $rows[$i][$nameCol] ?? '';
        if ($code === '' || $name === '') continue;

        $dni = $dniCol !== null ? ($rows[$i][$dniCol] ?? '') : '';
        if ($dni === '-' || !preg_match('/\d/', $dni)) $dni = '';

        $fechaIngreso = xlsx_parse_date_value($rows[$i][$ingresoCol ?? ''] ?? '');
        if ($ingresoCol !== null) {
            $raw = $rows[$i][$ingresoCol] ?? '';
            if ($raw !== '' && is_numeric($raw)) {
                // Serial de fecha de Excel (día 0 = 1899-12-30).
                $fechaIngreso = date('Y-m-d', (((int)$raw) - 25569) * 86400);
            }
        }

        $fechaNacimiento = xlsx_parse_date_value($rows[$i][$nacimientoCol ?? ''] ?? '');
        if ($nacimientoCol !== null) {
            $raw = $rows[$i][$nacimientoCol] ?? '';
            if ($raw !== '' && is_numeric($raw)) {
                $fechaNacimiento = date('Y-m-d', (((int)$raw) - 25569) * 86400);
            }
        }

        $out[] = [
            'code' => $code, 'name' => $name, 'dni' => $dni, 'fecha_ingreso' => $fechaIngreso,
            'puesto' => $puestoCol !== null ? ($rows[$i][$puestoCol] ?? '') : '',
            'fecha_nacimiento' => $fechaNacimiento,
            'telefono' => $telefonoCol !== null ? ($rows[$i][$telefonoCol] ?? '') : '',
            'email_personal' => $emailCol !== null ? ($rows[$i][$emailCol] ?? '') : '',
            'team'   => $teamCol !== null ? ($rows[$i][$teamCol] ?? '') : '',
        ];
    }
    return $out;
}

/** Lee la plantilla ASIGNACION y devuelve las filas con los campos operativos. */
function xlsx_read_assignments(string $path): array
{
    if (!class_exists('ZipArchive')) throw new RuntimeException('La extensión ZIP de PHP no está disponible en el servidor.');
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) throw new RuntimeException('No se pudo abrir el archivo Excel.');

    $shared = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml !== false && preg_match_all('/<si\b[^>]*\/>|<si\b[^>]*>(.*?)<\/si>/s', $ssXml, $m, PREG_SET_ORDER)) {
        foreach ($m as $match) {
            $si = $match[1] ?? '';
            $text = '';
            if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $si, $tm)) $text = implode('', $tm[1]);
            $shared[] = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
        }
    }
    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    if ($sheet === false) throw new RuntimeException('No se encontró la hoja de datos en el Excel.');

    $rows = [];
    if (preg_match_all('/<row\b[^>]*>(.*?)<\/row>/s', $sheet, $rm)) foreach ($rm[1] as $rowXml) {
        $cells = [];
        if (preg_match_all('/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/s', $rowXml, $cm, PREG_SET_ORDER)) foreach ($cm as $c) {
            $attr = $c[1]; $inner = $c[2] ?? '';
            if (!preg_match('/\br="([A-Z]+)\d+"/', $attr, $rc)) continue;
            $type = preg_match('/\bt="([^"]+)"/', $attr, $tm) ? $tm[1] : '';
            $val = '';
            if ($type === 'inlineStr') { if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $inner, $im)) $val = implode('', $im[1]); }
            elseif (preg_match('/<v>(.*?)<\/v>/s', $inner, $vm)) $val = $type === 's' ? ($shared[(int)$vm[1]] ?? '') : $vm[1];
            $cells[$rc[1]] = trim(html_entity_decode($val, ENT_QUOTES | ENT_XML1, 'UTF-8'));
        }
        $rows[] = $cells;
    }
    if (!$rows) return [];

    $cols = [];
    foreach ($rows[0] as $col => $txt) {
        $u = mb_strtoupper(preg_replace('/\s+/u', ' ', $txt));
        if (strpos($u, 'FECHA') !== false) $cols['date'] = $col;
        elseif (strpos($u, 'APELLIDOS') !== false || strpos($u, 'NOMBRES') !== false) $cols['name'] = $col;
        elseif (strpos($u, 'FUNCI') !== false && strpos($u, '1') !== false) $cols['funcion_1'] = $col;
        elseif (strpos($u, 'FUNCI') !== false && strpos($u, '2') !== false) $cols['funcion_2'] = $col;
        elseif (strpos($u, 'ZONA') !== false && strpos($u, '1') !== false) $cols['zona_1'] = $col;
        elseif (strpos($u, 'NAVE') !== false && preg_match('/(?:^|\s)2(?:\s|$)/', $u)) $cols['nave_2'] = $col;
        elseif (strpos($u, 'PUESTO') !== false) $cols['puesto'] = $col;
        elseif (strpos($u, 'NAVE') !== false) $cols['nave'] = $col;
    }
    if (empty($cols['name'])) throw new RuntimeException('La plantilla debe incluir la columna APELLIDOS Y NOMBRES.');

    $out = [];
    for ($i = 1; $i < count($rows); $i++) {
        $rawDate = $rows[$i][$cols['date'] ?? ''] ?? ''; $name = trim($rows[$i][$cols['name']] ?? '');
        if ($name === '') continue;
        $date = null;
        if (is_numeric($rawDate)) $date = date('Y-m-d', (((int)$rawDate) - 25569) * 86400);
        else {
            foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
                $d = DateTime::createFromFormat('!' . $format, trim($rawDate));
                if ($d && $d->format($format) === trim($rawDate)) { $date = $d->format('Y-m-d'); break; }
            }
        }
        $out[] = ['row' => $i + 1, 'date' => $date, 'name' => $name,
            'funcion_1' => $rows[$i][$cols['funcion_1'] ?? ''] ?? '', 'funcion_2' => $rows[$i][$cols['funcion_2'] ?? ''] ?? '',
            'zona_1' => $rows[$i][$cols['zona_1'] ?? ''] ?? '',
            'puesto' => $rows[$i][$cols['puesto'] ?? ''] ?? '', 'nave' => $rows[$i][$cols['nave'] ?? ''] ?? '',
            'nave_2' => $rows[$i][$cols['nave_2'] ?? ''] ?? ''];
    }
    return $out;
}

/** Lee una plantilla de radios: CODIGO, IMEI, MODELO y UBICACIÓN. */
function xlsx_read_radios(string $path): array
{
    if (!class_exists('ZipArchive')) throw new RuntimeException('La extensión ZIP de PHP no está disponible en el servidor.');
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) throw new RuntimeException('No se pudo abrir el archivo Excel.');
    $shared = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml !== false && preg_match_all('/<si\b[^>]*\/>|<si\b[^>]*>(.*?)<\/si>/s', $ssXml, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $text = '';
            if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $match[1] ?? '', $parts)) $text = implode('', $parts[1]);
            $shared[] = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
        }
    }
    $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    if ($sheet === false) throw new RuntimeException('No se encontró la hoja de datos en el Excel.');
    $rows = [];
    if (preg_match_all('/<row\b[^>]*>(.*?)<\/row>/s', $sheet, $rowMatches)) foreach ($rowMatches[1] as $rowXml) {
        $cells = [];
        if (preg_match_all('/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/s', $rowXml, $cellMatches, PREG_SET_ORDER)) foreach ($cellMatches as $cell) {
            if (!preg_match('/\br="([A-Z]+)\d+"/', $cell[1], $ref)) continue;
            $type = preg_match('/\bt="([^"]+)"/', $cell[1], $typeMatch) ? $typeMatch[1] : '';
            $inner = $cell[2] ?? ''; $value = '';
            if ($type === 'inlineStr') { if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $inner, $parts)) $value = implode('', $parts[1]); }
            elseif (preg_match('/<v>(.*?)<\/v>/s', $inner, $valueMatch)) $value = $type === 's' ? ($shared[(int)$valueMatch[1]] ?? '') : $valueMatch[1];
            $cells[$ref[1]] = trim(html_entity_decode($value, ENT_QUOTES | ENT_XML1, 'UTF-8'));
        }
        $rows[] = $cells;
    }
    if (!$rows) return [];
    $columns = [];
    foreach ($rows[0] as $column => $header) {
        $header = mb_strtoupper($header);
        if (strpos($header, 'COD') !== false) $columns['code'] = $column;
        elseif (strpos($header, 'IMEI') !== false) $columns['imei'] = $column;
        elseif (strpos($header, 'MODELO') !== false) $columns['model'] = $column;
        elseif (strpos($header, 'UBIC') !== false) $columns['location'] = $column;
    }
    if (empty($columns['code']) || empty($columns['imei']) || empty($columns['model'])) throw new RuntimeException('La plantilla debe incluir CODIGO, IMEI y MODELO.');
    $out = [];
    for ($i = 1; $i < count($rows); $i++) {
        $code = trim($rows[$i][$columns['code']] ?? ''); $imei = trim($rows[$i][$columns['imei']] ?? ''); $model = trim($rows[$i][$columns['model']] ?? '');
        if ($code === '' && $imei === '' && $model === '') continue;
        $out[] = ['row' => $i + 1, 'code' => $code, 'imei' => $imei, 'model' => $model, 'location' => trim($rows[$i][$columns['location'] ?? ''] ?? '')];
    }
    return $out;
}
