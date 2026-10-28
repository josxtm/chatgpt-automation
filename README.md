# ChatGPT Automation

Supervisor **multiproyecto** independiente para repositorios GitHub.

## Estado
v0.1: prototipo **solo lectura**. No desplegado. No ejecuta agentes, no modifica otros repositorios y no fusiona PR.

## Arquitectura
Cloudflare Worker (cron cada 3 minutos) + GitHub API + Cloudflare D1.
- Consulta PR abiertos de repositorios habilitados.
- Consulta check runs del SHA actual de cada PR.
- Registra estados green, red, pending, unknown y draft.
- Usa una lease en D1 para reducir solapamientos y evita duplicar observaciones.
- Falla de forma conservadora ante checks faltantes.

## Instalación (pendiente de autorización Cloudflare)
1. Crear base D1 `automation_db` y configurar su ID en `wrangler.toml`.
2. Aplicar `migrations/0001_init.sql`.
3. Configurar `GITHUB_TOKEN` como secreto del Worker, con acceso **solo lectura** a los repositorios elegidos (Pull requests y Checks).
4. Insertar repositorios habilitados en D1.
5. Ajustar `REQUIRED_CHECKS` a los nombres reales de checks; v0.1 utiliza una política global y **no se deben habilitar proyectos con políticas diferentes**.
6. Ejecutar `npm test`; desplegar con `npx wrangler deploy`.
7. Solo después de probarlo, cambiar `AUTOMATION_ENABLED` de `false` a `true`.

## Parada de emergencia
Establecer `AUTOMATION_ENABLED = "false"` y redesplegar o desactivar el cron en Cloudflare.

## Limitaciones pendientes
- Configuración de checks por repositorio, paginación de checks, branch protection y validación de SHA de merge.
- Panel autenticado, observabilidad y renovación de leases.
- Integración de agentes con permisos mínimos y máximo de tres reintentos.
- Política de fusiones: ninguna fusión sin verificaciones y aprobación explícita.
- El cron puede sufrir retrasos; tres minutos es una frecuencia solicitada, no una garantía de ejecución exacta.

**Nunca introducir secretos en este repositorio público.**
