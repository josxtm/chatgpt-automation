# ChatGPT Automation

Supervisor **multiproyecto** basado exclusivamente en **GitHub Actions**.

## v0.4 — Migración a GitHub Actions (propuesta)

- `Supervisor CI` valida los cambios del proyecto.
- `Multiproject Supervisor` se programa cada cinco minutos mediante GitHub Actions (la ejecución puede retrasarse).
- `scripts/supervise.mjs` inspecciona PR abiertos y check runs de los repositorios habilitados; recorre páginas hasta 1.000 resultados y **falla sin declarar verde** si se alcanza el límite.
- `supervisor.config.json` contiene una lista explícita de repositorios y checks obligatorios. **Inicialmente está vacía:** ningún repositorio es supervisado hasta que se configure.
- Se requiere el secreto `SUPERVISOR_GITHUB_TOKEN` con permisos mínimos de lectura para acceder a los repositorios elegidos. Sin él, el script termina indicando que está inactivo.
- La supervisión es **solo lectura**: no ejecuta agentes, no corrige código ni fusiona PR.

Ejemplo de configuración:

```json
{
  "repositories": [
    {
      "full_name": "owner/example",
      "enabled": true,
      "required_checks": ["test"]
    }
  ]
}
```

Los nombres de `required_checks` deben coincidir exactamente con los nombres de los checks de GitHub.

## Seguridad

- No incluir tokens ni secretos en el repositorio.
- Un check ausente, ambiguo o duplicado **nunca** se considera verde.
- El cron de GitHub no garantiza ejecución exacta cada cinco minutos.
- No se realizan fusiones automáticas.
- Antes de permitir acciones de escritura: verificar protección de ramas, identidad de commits, permisos y límites de reintentos.

## Migración

La implementación antigua de Cloudflare Worker y D1 permanece en el historial y en archivos heredados, pero **no forma parte de la arquitectura activa**. Su retirada del repositorio se realizará en una fase posterior, después de validar este nuevo workflow.

## Pruebas

Ejecutar `npm test`. El workflow `Supervisor CI` realiza esta comprobación en GitHub.
