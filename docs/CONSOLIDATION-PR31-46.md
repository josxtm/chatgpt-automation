# Consolidación controlada de PR #31–#46

Revisión: 2026-10-31. Base de comparación: `main` en `03fb87c27b8fd26ad640a6d66b3144134fbe9d29`. Rama candidata: `consolidation/review-pr18-46-20261031` (PR #47).

Esta matriz registra la correspondencia entre los cambios propuestos y los archivos de la rama candidata. **No acredita por sí sola equivalencia exacta de todos los commits ni autoriza cerrar PR**: las verificaciones finales son el diff, los tests, las revisiones pendientes y el CI del SHA final.

| PR | Cambio | Evidencia en la rama de consolidación |
| --- | --- | --- |
| #31 | Evidencia y documentación de recuperación | `README.md`, `docs/PRODUCTION.md` |
| #32 | Desfase de cron principal y auxiliar | `test/recovery-cron-stagger.test.js` |
| #33 | Runtime de Actions en CI | `.github/workflows/ci.yml` |
| #34 | Runtime de Actions del supervisor | `.github/workflows/supervisor.yml`, `test/supervisor-node24-actions.test.js` |
| #35 | Auditoría del cron de 24 horas | `docs/AUDIT-PR17-24H-2026-10-30.md`, `test/pr17-24h-evidence.test.js` |
| #36 | Guía de producción tras PR #30 | `docs/PRODUCTION.md` |
| #37 | Fechas UTC del diagnóstico de cron | `src/schedule-health.js`, `test/schedule-health-timestamps.test.js` |
| #38 | Fechas UTC de recibos de recuperación | `src/recovery.js`, `test/recovery-utc-timestamps.test.js` |
| #39 | Evitar recuperación con CI de SHA obsoleto | `.github/workflows/supervisor-recovery.yml`, `test/workflow-run-current-sha.test.js` |
| #40 | Comprobación de sintaxis de workflows | `.github/workflows/ci.yml` (`actionlint` con checksum), `test/ci-timeout.test.js` |
| #41 | Totales inconsistentes en paginación | `src/supervisor-core.js`, `test/supervisor-core.test.js` |
| #42 | Orden temporal de recibos de inspección | `src/recovery.js`, `test/recovery-receipt-order.test.js` |
| #43 | Fallar si no hay repositorios habilitados | `scripts/supervise.mjs`, `src/supervisor-core.js`, `test/supervisor-core.test.js` |
| #44 | Rechazar redirecciones autenticadas | `src/github-api.js`, `test/github-api.test.js` |
| #45 | Rechazar rutas ambiguas y traversal | `src/github-api.js`, `test/github-api.test.js` |
| #46 | Mostrar todos los huecos de más de 15 minutos | `scripts/audit-schedule.mjs`, `src/schedule-audit.js`, `test/schedule-audit-gap-details.test.js` |

## Verificación y decisión

- La validación anterior del PR #47 (`83ffe138dfea06ab8a210316ce7392a0a9ecab65`) terminó con **Supervisor CI #41201392655 verde**, incluidos `npm test` y `actionlint v1.7.12`. Cualquier nuevo commit **requiere una nueva ejecución verde** antes de considerarlo validado.
- Mantener el PR #47 en borrador y no fusionar sin revisión manual del diff y del CI correspondiente al SHA final.
- No fusionar los PR originales además del #47: podría duplicar o sobrescribir cambios; comprobar antes que el contenido definitivo está cubierto.
- No cerrar PR anteriores sin autorización expresa y revisión de sus comentarios y checks. La matriz #18–#29 está en `docs/CONSOLIDATION-PR18-29.md`.
- La regularidad de los eventos `schedule` se verifica por separado del CI; un workflow de tests verde no demuestra que el cron sea puntual.
- No activar Cloudflare, ampliar permisos, alterar los cron ni realizar fusiones automáticas.
