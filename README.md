# ChatGPT Automation

Supervisor **multiproyecto** independiente para repositorios GitHub.

## Estado
v0.2 (propuesta en PR): supervisor **solo lectura**, no desplegado. No ejecuta agentes, no modifica otros repositorios y no fusiona PR.

## Arquitectura
Cloudflare Worker (cron cada 3 minutos) + GitHub API + Cloudflare D1.
- Consulta PR abiertos de repositorios habilitados.
- Consulta check runs del SHA actual de cada PR.
- Registra estados green, red, pending, unknown y draft.
- Cada repositorio tiene sus propios nombres de comprobaciones obligatorias.
- Usa una lease en D1 para reducir solapamientos y evita duplicar observaciones.
- Si falta una política válida o un check requerido, el estado es **unknown**, nunca green.

## Instalación (pendiente de autorización Cloudflare)
1. Crear base D1 `automation_db` y configurar su ID en `wrangler.toml`.
2. Aplicar, en orden, `migrations/0001_init.sql` y `migrations/0002_repository_check_policies.sql` con Wrangler D1. Si la tabla ya existe, aplicar solo la migración pendiente.
3. Configurar `GITHUB_TOKEN` como secreto del Worker, con acceso **solo lectura** a los repositorios elegidos (Pull requests y Checks).
4. Registrar explícitamente los repositorios y sus checks reales. Ejemplo SQL (sustituir nombres por los de cada proyecto):

   ```sql
   INSERT INTO repositories(full_name,enabled,required_checks)
   VALUES ('owner/project-one',1,'["verify"]'),
          ('owner/project-two',1,'["lint","unit-tests"]');
   ```

5. Ejecutar `npm test`; desplegar con `npx wrangler deploy`.
6. Solo después de probarlo, cambiar `AUTOMATION_ENABLED` de `false` a `true` y redesplegar.

**Política por repositorio:** `required_checks` es un array JSON de nombres exactos de check runs, no una cadena separada por comas. Un valor vacío, inválido o con nombres duplicados se considera no configurado y **nunca da verde**. Los proyectos existentes migran con `[]` y deben configurarse explícitamente.

## Parada de emergencia
Establecer `AUTOMATION_ENABLED = "false"` y redesplegar o desactivar el cron en Cloudflare.

## Limitaciones pendientes
- Paginación de check runs, status contexts, branch protection y validación de SHA de merge.
- Panel autenticado, observabilidad y renovación de leases.
- Integración de agentes con permisos mínimos y máximo de tres reintentos.
- Política de fusiones: ninguna fusión sin verificaciones y aprobación explícita.
- El cron puede sufrir retrasos; tres minutos es una frecuencia solicitada, no una garantía de ejecución exacta.

**Nunca introducir secretos en este repositorio público.**
