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

## v0.6 — Diagnóstico de programación (propuesta de PR)

- El cron propuesto es `3-58/5 * * * *`: doce oportunidades por hora, cada cinco minutos, alejadas del minuto 0 (pico de carga habitual).
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
- El cron de GitHub no garantiza ejecución exacta cada diez minutos.
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

## Cadencia cada diez minutos (PR #11 integrado)

- El cron vigente `7-57/10 * * * *` solicita seis ejecuciones por hora, en los minutos 07, 17, 27, 37, 47 y 57 (UTC).
- `npm test` comprueba el paso de diez minutos, los seis disparos por hora, el desplazamiento respecto al minuto 0 y la continuidad entre horas.
- **Esta modificación solo entra en funcionamiento cuando el PR se fusiona manualmente en `main`**. Los cron de GitHub Actions se ejecutan desde la rama predeterminada.
- Para confirmar el funcionamiento real, comprobar en **Actions → Multiproject Supervisor** una nueva ejecución con evento `schedule` posterior a la fusión. Un CI verde o una ejecución `workflow_dispatch` no lo acreditan.
- GitHub Actions no garantiza puntualidad ni todos los disparos. No se activan Cloudflare, permisos de escritura ni fusiones automáticas.

## Verificación operativa del cron de 10 minutos

- El cron activo en `main` es `7-57/10 * * * *` (UTC). GitHub Actions puede retrasar u omitir ejecuciones; no equivale a una garantía de disponibilidad.
- Abrir [Multiproject Supervisor](https://github.com/josxtm/chatgpt-automation/actions/workflows/supervisor.yml) y filtrar por evento **schedule**. Comprobar que existen ejecuciones posteriores a la última fusión y revisar su **Summary → Supervisor execution evidence**.
- La presencia de `workflow_dispatch`, `pull_request` o un `Supervisor CI` verde **no demuestra** que el cron funcione.
- Si no hay nuevos `schedule` durante más de 30 minutos, comprobar que el workflow está habilitado, las políticas de Actions y la actividad del repositorio; consultar [estado de GitHub](https://www.githubstatus.com/). Una ejecución manual sirve para probar el código, no el planificador.
- No modificar secretos, habilitar Cloudflare ni fusionar PR automáticamente para solucionar retrasos del cron.

## v0.8 — Diagnóstico reforzado del cron (PR de revisión)

- Consulta en **solo lectura** si el workflow está habilitado y hasta 12 ejecuciones reales con evento `schedule`; distingue `never-seen`, `observed`, `stale`, `recent-not-green`, `stale-not-green`, `in-progress`, `stale-in-progress` y `unknown`.
- Muestra la ventana UTC, el mayor intervalo observado y enlaces a las dos ejecuciones que delimitan el hueco. Rechaza muestras incompletas o metadatos contradictorios en lugar de declarar el cron sano.
- Para el cron vigente de **10 minutos**, marca huecos superiores a **15 minutos** (cinco minutos de tolerancia). Advierte del silencio de un último disparo exitoso al superar **20 minutos** y mantiene `stale` a los **45 minutos**.
- Los avisos son diagnósticos, no una garantía de periodicidad ni una orden de ejecución. El supervisor permanece **solo lectura**: sin fusiones automáticas, permisos de escritura ni Cloudflare.
- Este PR parte de `main` actualizado y reemplaza funcionalmente al PR #10, que quedó desfasado tras fusionarse los PR #11, #12 y #13. **No fusionar ambos PR**; revisar y fusionar manualmente solo la versión actualizada tras CI verde.

- Diagnóstico adicional: compara el SHA del último `schedule` con el SHA de la ejecución actual. Si difieren, identifica que la última evidencia programada corresponde a una revisión anterior; **no** lo interpreta por sí solo como un fallo del planificador. Pruebas para SHA ausentes o inválidos.

### Criterio de aceptación antes de activar v0.8

1. Comprobar `Supervisor CI` verde en el commit exacto de la rama candidata.
2. Revisar que el PR se basa en el `main` vigente y que no se fusiona también el PR #10 (implementación anterior).
3. Tras la fusión **manual**, abrir el flujo `Multiproject Supervisor` y comprobar un `schedule` posterior a la fusión; no sustituir esta comprobación por un `workflow_dispatch`.
4. Revisar el Summary para distinguir `active`, `never-seen`, `older-revision`, silencio >20 minutos y huecos >15 minutos. Si no hay disparos automáticos, revisar la habilitación del workflow y las políticas del repositorio antes de cambiar el cron.
5. No considerar resuelta la periodicidad hasta observar varios `schedule` consecutivos; el planificador de GitHub es de mejor esfuerzo.

### Enlace del workflow y errores 404

Si el enlace de Actions basado en `supervisor.yml` devuelve **404** aunque el archivo exista en `main`, no asumir que el cron está deshabilitado. En el Summary de una ejecución del supervisor después de integrar esta mejora se mostrará un enlace alternativo construido con el **ID numérico del workflow**, obtenido en modo lectura de la API de GitHub. Si la API no devuelve un ID válido, se informará sin inventar un enlace. Si también falla el enlace por ID, revisar los permisos y el registro del workflow en Actions; la existencia del archivo y un CI verde no prueban el funcionamiento del cron.
