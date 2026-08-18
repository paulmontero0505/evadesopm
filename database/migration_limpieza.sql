-- ============================================================
--  Módulo: Cuidado y limpieza de instalaciones operativas
--  Plan de Sensibilización OPS-SEN-001 v1.0
--  COSCO SHIPPING PORTS CHANCAY PERÚ - Centro de Operaciones
-- ============================================================
--  Ejecutar una sola vez sobre la base de datos del sistema.
--  Todas las tablas usan el prefijo limpieza_ para convivir con el resto
--  del esquema, y se apoyan en users/auth_tokens: el módulo NO tiene
--  usuarios ni sesiones propias.

-- ------------------------------------------ caso 1: encuesta de percepción

CREATE TABLE IF NOT EXISTS limpieza_encuestas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  fase       ENUM('diagnostico','cierre') NOT NULL,
  fecha      DATE         NOT NULL,
  turno      ENUM('dia','noche') NOT NULL,
  user_id    INT          NULL,          -- quien respondió (users.id)
  empleado   VARCHAR(20)  NOT NULL,      -- users.employee_number al momento de responder
  nombre     VARCHAR(120) NOT NULL,
  cargo      VARCHAR(150) NOT NULL,      -- users.puesto
  zona       VARCHAR(60)  NOT NULL,      -- declarada en el formulario
  preocupa   VARCHAR(20)  NULL,          -- instalación que más preocupa
  comentario TEXT         NULL,
  promedio   DECIMAL(3,2) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_limpieza_encuestas_fase (fase),
  KEY ix_limpieza_encuestas_fecha (fecha),
  CONSTRAINT fk_limpieza_encuesta_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Una fila por pregunta: el cuestionario puede crecer sin tocar el esquema.
CREATE TABLE IF NOT EXISTS limpieza_encuesta_respuestas (
  encuesta_id INT         NOT NULL,
  pregunta    VARCHAR(10) NOT NULL,
  valor       TINYINT     NOT NULL,      -- 1..5
  PRIMARY KEY (encuesta_id, pregunta),
  CONSTRAINT fk_limpieza_respuesta_encuesta FOREIGN KEY (encuesta_id)
    REFERENCES limpieza_encuestas (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------- caso 2: inspección cruzada de relevo

CREATE TABLE IF NOT EXISTS limpieza_inspecciones (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  instalacion     ENUM('pin','paradero','cabina','balanza') NOT NULL,
  ubicacion       VARCHAR(120) NOT NULL,
  fecha           DATE         NOT NULL,
  turno_entrante  ENUM('dia','noche') NOT NULL,
  turno_saliente  ENUM('dia','noche') NOT NULL,
  inspector       VARCHAR(120) NOT NULL,
  inspector_cargo VARCHAR(150) NOT NULL,
  empleado        VARCHAR(20)  NOT NULL,
  user_id         INT          NULL,
  conformidad     TINYINT      NULL,     -- 0..100, NULL si todo fue N/A
  semaforo        VARCHAR(10)  NULL,     -- verde / ambar / rojo / sin
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_limpieza_insp_instalacion (instalacion),
  KEY ix_limpieza_insp_fecha (fecha),
  CONSTRAINT fk_limpieza_insp_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS limpieza_inspeccion_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  inspeccion_id INT          NOT NULL,
  orden         TINYINT      NOT NULL,
  item_id       VARCHAR(20)  NOT NULL,   -- pin1, cab3, bal4...
  texto         TEXT         NOT NULL,   -- se guarda el literal del estándar vigente
  critico       TINYINT(1)   NOT NULL DEFAULT 0,
  estado        ENUM('C','NC','NA') NOT NULL DEFAULT 'NA',
  comentario    TEXT         NULL,
  foto          VARCHAR(255) NULL,       -- ruta relativa, ej. uploads/limpieza/...
  KEY ix_limpieza_items_inspeccion (inspeccion_id),
  KEY ix_limpieza_items_estado (estado),
  CONSTRAINT fk_limpieza_item_inspeccion FOREIGN KEY (inspeccion_id)
    REFERENCES limpieza_inspecciones (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------- caso 3: registro de hallazgos

CREATE TABLE IF NOT EXISTS limpieza_hallazgos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  fecha            DATE         NOT NULL,
  turno            ENUM('dia','noche') NOT NULL,
  instalacion      ENUM('pin','paradero','cabina','balanza') NOT NULL,
  ubicacion        VARCHAR(120) NOT NULL,
  descripcion      TEXT         NOT NULL,
  trabajador       VARCHAR(120) NULL,
  aprobador        VARCHAR(150) NULL,
  registrado_por   VARCHAR(120) NOT NULL,
  registrado_cargo VARCHAR(150) NOT NULL,
  user_id          INT          NULL,
  estado           ENUM('abierto','correccion','cerrado') NOT NULL DEFAULT 'abierto',
  foto             VARCHAR(255) NULL,
  -- Ítem de inspección que lo originó: "<inspeccion_id>:<item_id>".
  -- El índice único evita dos hallazgos para el mismo ítem.
  origen           VARCHAR(80)  NULL,
  cierre_fecha     DATE         NULL,
  cierre_por       VARCHAR(120) NULL,
  cierre_nota      TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_limpieza_hallazgo_origen (origen),
  KEY ix_limpieza_hallazgos_instalacion (instalacion),
  KEY ix_limpieza_hallazgos_estado (estado),
  KEY ix_limpieza_hallazgos_fecha (fecha),
  CONSTRAINT fk_limpieza_hallazgo_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
