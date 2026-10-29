# ChatGPT Automation

Supervisor **multiproyecto** basado exclusivamente en **GitHub Actions**.

## v0.4 — Migración a GitHub Actions

- `Supervisor CI` valida los cambios del proyecto.
- `Multiproject Supervisor` se programa cada cinco minutos mediante GitHub Actions (la ejecución puede retrasarse).
- `scripts/supervise.mjs` inspecciona PR abiertos y check runs de los repositorios habilitados; recorre páginas hasta 1.000 resultados y **falla sin declarar verde** si se alcanza el límite.
- `supervisor.config.json` contiene una lista explícita de repositorios y checks obligatorios. **Inicialmente supervisa únicamente `josxtm/chatgpt-automation`**, usando el token integrado de GitHub.
- El token integrado de GitHub permite supervisar este repositorio. Para otros repositorios, configurar `SUPERVISOR_GITHUB_TOKEN` con permisos mínimos de lectura sobre los repositorios seleccionados.
- La supervisión es **solo lectura**: no ejecuta agentes, no corrige código ni fusiona PR. El workflow programado se ejecuta desde la rama predeterminada después de integrar el PR.

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

## v0.5 — Informes visibles (integrado en main)

- Cada ejecución muestra un informe en **Actions → Multiproject Supervisor → ejecución → Summary**.
- El informe incluye fecha UTC, disparador (`schedule` o `workflow_dispatch`), rama, repositorios revisados y enlaces directos a PR con su commit y estado.
- Los PR borrador se clasifican como `draft`; no se consideran verdes. Un PR sin checks completos no se considera verde.
- El workflow programado solo utiliza la versión de `main`. Los informes de v0.5 ya están integrados; para verlos hay que abrir una ejecución posterior a esa integración.
- La ejecución manual verde y la ejecución periódica son comprobaciones distintas: para validar el cron deben aparecer ejecuciones cuyo disparador sea `schedule`.

## v0.6 — Diagnóstico de programación (integrado en main)

- El cron configurado es `3-58/5 * * * *`: doce oportunidades por hora, cada cinco minutos, alejadas del minuto 0 (pico de carga habitual).
- Se mantiene `workflow_dispatch` para pruebas manuales, el modo **solo lectura** y la política de no fusionar PR automáticamente.
- `npm test` verifica que el cron conserva exactamente doce intervalos de cinco minutos, incluidos los límites entre horas.
- **Importante:** GitHub Actions no garantiza el inicio puntual ni la ejecución de todos los cron. Desplazar los minutos es una medida de mitigación, **no una prueba de que la programación esté funcionando**.

### Comprobar las ejecuciones periódicas

1. Abrir **Actions → Multiproject Supervisor** y seleccionar una ejecución.
2. En el resumen, comprobar el campo **Disparador**. `schedule` acredita un disparo programado; `workflow_dispatch` solo acredita una ejecución manual.
3. Si no aparece ningún `schedule`, revisar que el workflow está habilitado, que reside en la rama predeterminada y que GitHub Actions está permitido. Revisar también la actividad y posibles retrasos de GitHub.
4. Si sigue sin ejecutarse, investigar el planificador de GitHub y los permisos del repositorio; **no declarar resuelto el problema únicamente porque el CI sea verde**.

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

## v0.7 — Diagnóstico del cron en el resumen (integrado en main)

- Cada ejecución de **Multiproject Supervisor** consulta en modo lectura el último run cuyo evento sea \`schedule\` mediante la API de GitHub Actions.
- El informe distingue: \`never-seen\` (ningún disparo programado), \`stale\` (último disparo hace más de 45 minutos), \`in-progress\`, \`recent-not-green\`, \`observed\` y \`unknown\`.
- El diagnóstico es **informativo** y no modifica repositorios ni fusiona PR; un fallo al consultar el historial no bloquea la inspección de PR.
- El permiso adicional \`actions: read\` se limita a lectura. Una ejecución manual verde no prueba el cron; un único \`observed\` tampoco demuestra periodicidad sostenida.
- Si el historial muestra \`never-seen\`, revisar el estado de habilitación del workflow y las restricciones de Actions en GitHub. El cron sigue siendo best-effort.

## v0.8 — Diagnóstico del estado del workflow (PR de revisión)

- El resumen consulta en **solo lectura** el endpoint de GitHub Actions para saber si `Multiproject Supervisor` está habilitado, deshabilitado manualmente, deshabilitado por inactividad, deshabilitado en un fork o eliminado.
- Un estado `active` **no demuestra** que GitHub haya ejecutado el cron. El historial de disparos `schedule` se sigue mostrando de forma independiente.
- Si el workflow está deshabilitado, el informe indica que hay que habilitarlo en Actions; **no cambia la configuración ni activa nada automáticamente**.
- Si GitHub no permite consultar el estado, se muestra `unknown` sin detener la inspección de PR. El token solo necesita `actions: read`, ya configurado.
- Pruebas unitarias cubren estados activos, deshabilitados, eliminados y metadatos inesperados. No se activan servicios externos ni Cloudflare.
