# PortTrack Performance

Sistema de evaluacion de desempeno para OPM de COSCO Shipping Ports Chancay. Registra evidencia por turno, evalua conductas corporativas y consolida la evaluacion trimestral con reglas de cobertura y trazabilidad.

## Tecnologia

| Capa | Tecnologia | Uso |
| --- | --- | --- |
| Frontend | React 18, React Router, Vite 5 | SPA, navegacion y compilacion de recursos estaticos |
| Interfaz | CSS propio y Lucide React | Estilos e iconos |
| Backend | PHP con PDO | API JSON, autenticacion y reglas de negocio |
| Base de datos | MariaDB 10.4 o MySQL 8 | Datos operativos, fichas, evaluaciones y tokens |
| Servidor | Apache/XAMPP | Publicacion de la SPA, API y archivos cargados |

No se usa un framework PHP ni un ORM. Las consultas se ejecutan mediante sentencias PDO preparadas.

## Arquitectura

```text
Navegador
  -> React SPA (frontend/src)
  -> API PHP (backend/index.php)
  -> reglas y autorizacion (backend/lib)
  -> MariaDB/MySQL (database/schema.sql)

Build de Vite -> raiz del proyecto (index.html y assets/)
Archivos de evidencia -> uploads/
```

| Ruta | Responsabilidad |
| --- | --- |
| `frontend/src` | Codigo fuente de la SPA: vistas, rutas, cliente API, estado de sesion y turno. |
| `frontend/src/pages` | Pantallas de login, fichas, control, evaluacion, administracion, asignaciones y radios. |
| `backend/index.php` | Front controller y enrutador de la API. |
| `backend/api` | Casos de uso HTTP por dominio: autenticacion, OPM, fichas, compromiso, evaluaciones, usuarios, asignaciones y radios. |
| `backend/lib` | Conexion, respuesta HTTP, autenticacion, catalogos y reglas de calculo. |
| `backend/config` | Configuracion de base de datos y modo de depuracion. |
| `database` | Esquema inicial y migraciones incrementales. |
| `uploads` | Fotos de eventos, conductas y movimientos de radios. No es codigo fuente. |
| `assets` e `index.html` | Resultado publicado de `npm run build`. No editar manualmente. |

## Modulos funcionales

- Autenticacion por numero de empleado y contrasena. La API emite tokens Bearer con vigencia de 12 horas.
- Administracion de usuarios y OPM, con altas, edicion, inactivacion e importacion desde plantillas XLSX.
- Asignacion de OPM y supervisores por fecha y turno; una ficha solo se puede registrar para un OPM asignado.
- Fichas de desempeno por turno: seguridad, ejecucion tecnica, productividad y cuidado de carga/equipos.
- Fichas de compromiso: comunicacion, adaptabilidad, trabajo en equipo, iniciativa, respeto, seguridad y resultados.
- Control de cobertura y evaluacion trimestral consolidada.
- Inventario, entrega, reasignacion, devolucion y reportes de radios.

## Logica de evaluacion

El backend es la fuente de verdad. El frontend obtiene los catalogos mediante `GET /rules` y `GET /compromiso-rules`, pero nunca decide los promedios definitivos.

1. El supervisor selecciona fecha y turno, y elige un OPM previamente asignado.
2. Registra cada actividad como 1 a 5 o `No aplica`. Una ficha debe incluir al menos una actividad calificada.
3. El servidor valida la carga, turno, asignacion y limites de registro; guarda la ficha, el detalle por actividad y los promedios por objetivo en una transaccion.
4. Un evento de seguridad limita a 2.5 los objetivos O1 y O3 de la ficha de desempeno. Una conducta critica limita a 2.5 el objetivo O5 de compromiso.
5. Para cada objetivo, el consolidado trimestral divide la suma entre el mayor valor de fichas observadas y el piso minimo. Esto evita que pocas observaciones produzcan una nota alta engañosa.
6. La evidencia de desempeno es valida con al menos 8 fichas, cobertura de muestreo y tres evaluadores; la de compromiso requiere al menos 4 fichas y tres evaluadores. Las fichas de un administrador constituyen una excepcion de validacion para pruebas y operacion administrativa.
7. La nota final combina desempeno (70 %) y compromiso (30 %). Los niveles son `Sobre` desde 4.5, `Cumple` desde 3.0 y `Por Debajo` por debajo de 3.0.
8. Si el resultado preliminar es `Sobre` y compromiso queda `Por Debajo`, la regla CSPCP bloquea el resultado final en `Cumple`.

Los limites de registro para supervisores se aplican en el servidor. En desempeno hay un maximo trimestral de 8 fichas por OPM, un maximo de 3 por supervisor y OPM, y un maximo de 2 por tipo de carga. En compromiso hay un maximo trimestral de 4 fichas por OPM y hasta 2 fichas del mismo supervisor por OPM al mes. El administrador esta exento de las cuotas personales, salvo la cobertura por carga.

## Roles y acceso

| Rol | Acceso principal |
| --- | --- |
| `admin` | Administracion de usuarios, OPM, asignaciones y catalogo; puede gestionar todos los registros. |
| `supervisor` | Registro y consulta de fichas, evaluacion y control dentro del flujo operativo. |
| `coordinator` | Operacion y control de radios. |

La SPA protege rutas por sesion, turno seleccionado y rol. La API vuelve a validar la sesion y permisos antes de procesar cada solicitud.

## Instalacion local

Requisitos: XAMPP con Apache, PHP con extensiones `pdo_mysql`, `mbstring`, `fileinfo` y `zip`, MariaDB/MySQL, Node.js compatible con Vite 5 y npm.

1. Ubicar el proyecto en `C:\xampp\htdocs\evadesopm`.
2. Iniciar Apache y MySQL desde XAMPP.
3. Crear la base de datos y tablas importando `database/schema.sql` con phpMyAdmin o la consola MySQL.
4. Para una base existente, revisar `database/migration_*.sql` y ejecutar solamente las migraciones aun no aplicadas, siguiendo la compatibilidad de la version desplegada.
5. Crear `backend/config/config.local.php` desde `backend/config/config.local.example.php` y definir las credenciales locales. No versionar este archivo.
6. Instalar las dependencias y generar el frontend:

```powershell
Set-Location C:\xampp\htdocs\evadesopm\frontend
npm install
npm run build

Set-Location C:\xampp\htdocs\evadesopm
php backend/seed.php
```

7. Abrir `http://localhost/evadesopm/`.
8. El seed crea el usuario inicial `0000001` con contrasena `admin123`. Cambiarla inmediatamente y no usarla en entornos expuestos.

## Desarrollo y publicacion

Para trabajar con recarga en caliente, crear `frontend/.env.local` con la URL de la API local y ejecutar Vite:

```text
VITE_API_BASE=http://localhost/evadesopm/backend/index.php
```

```powershell
Set-Location C:\xampp\htdocs\evadesopm\frontend
npm run dev
```

Vite escucha por defecto en el puerto `5174`. Para publicar cambios en Apache, ejecutar `npm run build`; la configuracion genera `index.html` y `assets/` en la raiz sin borrar `backend`, `database`, `frontend` ni `uploads`.

## Forma de trabajo

1. Antes de cambiar una regla de evaluacion, modificar su fuente en `backend/lib/rules.php` o `backend/lib/rules_compromiso.php`; no duplicar la regla solo en React.
2. Si cambia el esquema, crear una migracion SQL nueva en `database/`, conservar el esquema de instalacion actualizado y registrar como aplicarla en el cambio.
3. Si se agrega una operacion HTTP, implementar su handler en `backend/api`, declarar la ruta y metodo en `backend/index.php`, y exponerla desde `frontend/src/api.js`.
4. Aplicar autorizacion con `require_auth()` o `require_role()` antes de consultar o modificar datos sensibles.
5. Validar siempre en PHP los datos recibidos y recalcular valores derivados en el servidor. El cliente es solo una interfaz.
6. Para evidencias fotografias, conservar las validaciones de tipo y tamano y mantener `uploads/` escribible por Apache.
7. Ejecutar `npm run build` antes de entregar cambios de interfaz y probar manualmente el flujo afectado con los roles involucrados.

## Verificacion minima

- Ejecutar `npm run build` desde `frontend`.
- Verificar la respuesta de `http://localhost/evadesopm/backend/index.php`.
- Iniciar sesion y comprobar la proteccion de una ruta sin sesion.
- Registrar una ficha con valores, una actividad `No aplica` y, cuando corresponda, evidencia fotografica.
- Confirmar que la evaluacion trimestral refleja los limites, cobertura y bloqueo de compromiso.
- Probar importaciones y movimientos de radios si el cambio afecta esos modulos.

## Seguridad operativa

- Mantener `DEBUG` en `false` fuera de desarrollo.
- No publicar `backend/config/config.local.php` ni credenciales de base de datos.
- Usar HTTPS y restringir CORS antes de exponer la aplicacion fuera de una red controlada; la configuracion actual permite cualquier origen.
- Respaldar la base de datos y `uploads/`, ya que ambos contienen trazabilidad operativa.
#   e v a d e s o p m  
 