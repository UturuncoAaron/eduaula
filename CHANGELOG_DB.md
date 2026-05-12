# CHANGELOG_DB

Registro de cambios sobre el esquema de base de datos del proyecto EduAula.

Cada entrada indica el tipo de objeto, el motivo del cambio, el script SQL
que lo aplica y si ya fue desplegado en producción (Render).

---

## [2026-05-11] - Módulo Histórico de Alumnos

Iteración completa del módulo "Histórico de Alumnos" del panel admin.
El módulo es **read-only**, **paginado server-side** y **siempre acotado
por sección** para mantener la escalabilidad con 600+ alumnos en
producción.

### Tipo: Índices (idempotente, sin tablas/vistas nuevas)

- **Objetos:**
  - `idx_alumnos_anio_ingreso`   (btree sobre `alumnos.anio_ingreso`)
  - `idx_matriculas_historico`   (btree sobre `matriculas (alumno_id, periodo_id DESC)`)
  - `idx_matriculas_seccion`     (btree parcial sobre `matriculas (seccion_id, periodo_id)` WHERE `activo`)
  - `idx_periodos_anio`          (btree sobre `periodos (anio, bimestre)`)
- **Motivo:** Soportar los endpoints
  - `GET /api/admin/historico/anios`
  - `GET /api/admin/historico/filtros?anio=…`
  - `GET /api/admin/historico/alumnos?anio=…&seccion_id=…&page=&limit=`
- **Script:** `historico_alumnos.sql`
- **Aplicado en producción:** Pendiente

#### Decisiones de diseño

- **NO se creó la vista materializada `mv_historico_alumnos`.** Se
  evaluó y se descartó: con ≈600 alumnos y los índices listados
  arriba la query directa (`DISTINCT ON (alumno_id)` sobre
  `matriculas` filtrada por `periodos.anio`) resuelve por debajo de
  50 ms, evitando la complejidad operativa de `REFRESH MATERIALIZED
  VIEW` y triggers asociados.
- El script es **100% idempotente** (`CREATE INDEX IF NOT EXISTS`).
- **Owner** de todos los objetos: `eduaula`. El script asegura el
  ownership con un bloque `DO $$ ... $$` que sólo aplica si el rol
  existe (no rompe en entornos donde se corra como otro superusuario).
- Si la BD destino ya tenía estos índices (caso de los entornos
  actuales), el script no produce cambios.

### Tipo: Detección defensiva de columna en runtime

- **Objeto:** `alumnos.anio_ingreso` — se asume su existencia (índice
  ya presente en producción) pero algunos entornos de desarrollo
  pueden no tenerla todavía.
- **Implementación:** `HistoricoService.hasAnioIngreso()` consulta
  `information_schema.columns` la primera vez y cachea el resultado.
  Si la columna no existe, los queries del histórico se adaptan
  (omiten `alumnos.anio_ingreso` en el `SELECT` y devuelven
  `NULL::int AS anio_ingreso`). Esto evita 500s y permite levantar
  el módulo en entornos parcialmente migrados.
- **Sin DDL nuevo** — esta protección es a nivel de aplicación.

### Tipo: Validación de input en backend (defensa en profundidad)

- **Objeto (lógico):** endpoint `/api/admin/historico/alumnos`.
- **Cambio:** `HistoricoService.findAlumnosPorAnio` lanza
  `BadRequestException` si la llamada no incluye `grado_id` ni
  `seccion_id`. La UI nunca llama sin sección, pero esta protección
  garantiza que **nunca** se pueda barrer todos los alumnos del año
  desde el endpoint público (escalabilidad ante 600+ alumnos).
- **Sin DDL nuevo.**

### Tipo: Permisos / módulos

- **Objeto:** constante `MODULOS.HISTORICO_ALUMNOS = 'historico_alumnos'`
  añadida en `backendcapstone/src/modules/auth/constants/modulos.ts`
  y agregada al array de módulos del rol `admin` (`MODULOS_POR_ROL.admin`).
- **Espejo en frontend:** `eduaula/src/app/core/auth/modulos.ts` →
  `MODULO.HISTORICO_ALUMNOS`. El sidebar muestra la entrada
  "Histórico de Alumnos" gateada por este módulo.
- **Endpoint protegido:** todos los endpoints del controller
  `HistoricoController` exigen `@UseGuards(JwtAuthGuard, RolesGuard)`
  con `@Roles('admin')`. Doble gateo (modulo + rol).
- **Sin DDL nuevo** — el módulo se entrega vía JWT (no se persiste
  por usuario en BD).

### Notas de UX que afectan a las queries

- El frontend implementa un formulario con tres dropdowns siempre
  habilitados (año, grado, sección). El endpoint de alumnos
  **sólo se invoca al pulsar "Consultar"** y siempre con
  `seccion_id`, por lo que cada consulta trae a lo sumo ~35 filas
  (capacidad típica de una sección).
- Las opciones de grado y sección se obtienen una sola vez por año
  vía `/admin/historico/filtros`. Cambiar el año dispara una sola
  llamada; cambiar grado/sección no genera tráfico al backend.
- No se usa **polling**. Las consultas son síncronas REST clásicas
  (no se requiere SSE en este módulo: las acciones las inicia el
  usuario y la respuesta es directa).

### Archivos relevantes

#### Backend
- `backendcapstone/src/modules/historico/historico.module.ts`
- `backendcapstone/src/modules/historico/historico.controller.ts`
- `backendcapstone/src/modules/historico/historico.service.ts`
- `backendcapstone/src/modules/auth/constants/modulos.ts` (alta de
  `HISTORICO_ALUMNOS` y asignación a `admin`)
- `backendcapstone/src/app.module.ts` (registro del `HistoricoModule`)

#### Frontend
- `eduaula/src/app/features/admin/historico-alumnos/historico-alumnos.{ts,html,scss}`
  — página `/admin/historico` con formulario de filtros + resultados
- `eduaula/src/app/features/admin/historico-alumnos/components/selector-anio/`
- `eduaula/src/app/features/admin/historico-alumnos/components/tabla-alumnos-historico/`
- `eduaula/src/app/features/admin/admin.routes.ts` (ruta `historico`)
- `eduaula/src/app/shared/components/sidebar/navigation.config.ts`
  (item "Histórico de Alumnos" en grupo Usuarios)
- `eduaula/src/app/core/auth/modulos.ts` (alta de `HISTORICO_ALUMNOS`)

