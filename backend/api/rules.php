<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/rules.php';

/** GET /rules — catálogo de objetivos, actividades, cargas, conductas y parámetros. */
function handle_rules(): void
{
    require_auth();
    json_response(['rules' => rules_catalog()]);
}
