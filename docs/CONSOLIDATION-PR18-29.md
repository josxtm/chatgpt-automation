# Matriz de consolidación: PR #18–#29

Fecha de revisión: 2026-10-31. Referencia: `main` en `03fb87c27b8fd26ad640a6d66b3144134fbe9d29` (integración del PR #30).

Esta matriz compara **funcionalidades y pruebas**, no solo relaciones entre commits. Los PR antiguos tienen ramas divergentes; no deben fusionarse indiscriminadamente sobre `main`. La presencia de código equivalente en `main` no significa que cada commit original se haya fusionado individualmente.

| PR | Funcionalidad propuesta | Evidencia equivalente en `main` | Evaluación |
| --- | --- | --- | --- |
| #18 | README sincronizado con cron de 10 min y prueba de sincronización | `README.md`, `test/readme-cron-sync.test.js`, `.github/workflows/supervisor.yml` | Cubierto |
| #19 | Rechazar nombres de repositorio inseguros y duplicados sin distinguir mayúsculas | `src/supervisor-core.js:validateRepositories` | Cubierto |
| #20 | Validar todos los metadatos de PR antes de consultar checks y detectar duplicados | `src/supervisor-core.js:inspectRepository` | Cubierto |
| #21 | No declarar verde un check pendiente con conclusión; tratar `startup_failure` y `stale` como rojo | `src/decision.js:decide` | Cubierto |
| #22 | Probar permisos mínimos y serialización del supervisor | `test/supervisor-schedule.test.js` | Cubierto |
| #23 | Auditoría de ventana UTC de 24 h con paginación y fallo ante historial incompleto | `src/schedule-audit.js`, `scripts/audit-schedule.mjs`, `test/schedule-audit.test.js` | Cubierto |
| #24 | Cliente GitHub con tiempo de espera limitado y consultas de solo lectura | `src/github-api.js`, `scripts/supervise.mjs`, `test/github-api.test.js` | Cubierto |
| #25 | Validación estricta de datos antes de construir enlaces de PR | `src/summary.js`, `test/summary.test.js` | Cubierto |
| #26 | Tiempo máximo de 5 minutos para Supervisor CI | `.github/workflows/ci.yml`, `test/ci-timeout.test.js` | Cubierto |
| #27 | Evitar consultas de checks para PR en borrador | `src/supervisor-core.js:inspectRepository` | Cubierto |
| #28 | Prueba de alcance explícito a este repositorio | `test/config-scope.test.js`, `supervisor.config.json` | Cubierto |
| #29 | Rechazar muestras incompletas o contradictorias de la revisión del cron | `src/schedule-health.js:assessScheduleRevision`, `test/schedule-health.test.js` | Cubierto |

## Decisión de mantenimiento

- Los doce PR **parecen funcionalmente redundantes** frente a `main` en el alcance descrito; no se requiere aplicar sus commits antiguos para conservar esas funcionalidades.
- No se cierran PR automáticamente. Antes del cierre, comprobar el estado actual de `main`, las pruebas y los comentarios de revisión de cada PR; cerrar únicamente con autorización expresa.
- El PR #47 concentra las mejoras posteriores (#31–#46) para revisión manual y CI; no debe fusionarse hasta validar el SHA exacto de su rama.
- No cambiar la programación, activar Cloudflare, ampliar permisos ni fusionar automáticamente. El CI verde **no** demuestra cadencia de eventos `schedule`.
