# ChatGPT Automation

Supervisor **multiproyecto** basado exclusivamente en **GitHub Actions**.

## v0.4 — Migración a GitHub Actions

- `Supervisor CI` valida los cambios del proyecto.
- `Multiproject Supervisor` se programa cada diez minutos mediante GitHub Actions (la ejecución puede retrasarse).
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

El CI también valida la sintaxis de **todos** los workflows `.github/workflows/*.yml`
con `actionlint` v1.7.12, descargado desde su release oficial y verificado con
SHA-256 fijo. Esto detecta YAML o expresiones de Actions inválidas antes de
fusionar, incluso si las pruebas de Node pasan. La validación no requiere permisos
de escritura ni activa Cloudflare; no sustituye la verificación de los disparos
reales `schedule` después de la fusión.

## v0.7 — Diagnóstico del cron en el resumen (integrado en main)

- Cada ejecución de **Multiproject Supervisor** consulta en modo lectura el último run cuyo evento sea \`schedule\` mediante la API de GitHub Actions.
- El informe distingue: \`never-seen\` (ningún disparo programado), \`stale\` (último disparo hace más de 45 minutos), \`in-progress\`, \`recent-not-green\`, \`observed\` y \`unknown\`.
- El diagnóstico es **informativo** y no modifica repositorios ni fusiona PR; un fallo al consultar el historial no bloquea la inspección de PR.
- El permiso adicional \`actions: read\` se limita a lectura. Una ejecución manual verde no prueba el cron; un único \`observed\` tampoco demuestra periodicidad sostenida.
- Si el historial muestra \`never-seen\`, revisar el estado de habilitación del workflow y las restricciones de Actions en GitHub. El cron sigue siendo best-effort.

## Cadencia cada diez minutos (PR #11 integrado; resincronización PR #17)

- El cron vigente tras fusionar el PR #17 es `3-53/10 * * * *`: seis oportunidades por hora, en los minutos 03, 13, 23, 33, 43 y 53 (UTC). El PR #11 introdujo inicialmente `7-57/10`; ya no es el valor activo.
- `npm test` comprueba el paso de diez minutos, los seis disparos por hora, el desplazamiento respecto al minuto 0 y la continuidad entre horas.
- **Esta modificación solo entra en funcionamiento cuando el PR se fusiona manualmente en `main`**. Los cron de GitHub Actions se ejecutan desde la rama predeterminada.
- Para confirmar el funcionamiento real, comprobar en **Actions → Multiproject Supervisor** una nueva ejecución con evento `schedule` posterior a la fusión. Un CI verde o una ejecución `workflow_dispatch` no lo acreditan.
- GitHub Actions no garantiza puntualidad ni todos los disparos. No se activan Cloudflare, permisos de escritura ni fusiones automáticas.

## Verificación operativa del cron de 10 minutos

- El cron activo en `main` es `3-53/10 * * * *` (UTC), desde el PR #17. GitHub Actions puede retrasar u omitir ejecuciones; no equivale a una garantía de disponibilidad.
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

## Auditoría de 24 horas tras el PR #17 (pendiente de resultados)

- **Ventana de observación:** desde el merge de `4b29aa62a2430cc22a337fb72ec56d68b314777a` (2026-10-29 23:21:34 UTC) hasta 2026-10-30 23:21:34 UTC. No interpretar resultados parciales como un informe de 24 horas.
- Consultar el historial de `Multiproject Supervisor` filtrando **exclusivamente** por `event=schedule` y por `created_at` dentro de esa ventana. Excluir `workflow_dispatch`, `pull_request`, `push` y `Supervisor CI`. Registrar ID, URL, fecha UTC, estado, conclusión y SHA de cada ejecución; paginar el historial si es necesario.
- Ordenar los disparos por fecha y calcular los intervalos entre pares consecutivos. Informar de número de disparos, número de intervalos **>15 minutos**, intervalo máximo y enlaces a las dos ejecuciones que delimitan cada hueco. Medir por separado la espera desde el inicio de la ventana hasta el primer disparo y desde el último disparo hasta el cierre: no son intervalos entre ejecuciones.
- El cron solicita 144 oportunidades en 24 horas, pero GitHub Actions puede retrasar u omitir disparos. Una muestra con pocos registros, un CI verde o un único `schedule` no acreditan periodicidad. No inventar resultados si la API devuelve páginas incompletas o metadatos inconsistentes.
- **Si persisten huecos >15 minutos**, validar la recuperación consolidada y pruebas de concurrencia e idempotencia. Verificar la existencia de una ejecución activa o completada para el intervalo lógico antes de recuperar; serializar el trabajo y no reejecutar por separado todos los intervalos omitidos. Un segundo cron de GitHub tampoco garantiza recuperación si GitHub deja de emitir todos los disparos.
- **Política:** no activar Cloudflare, no ampliar permisos ni fusionar automáticamente; exigir `Supervisor CI` verde para el commit exacto de cualquier PR candidato. La auditoría y el mecanismo de recuperación se validan por separado.


## Recuperación consolidada (pendiente de fusión manual)

`supervisor-recovery.yml` ofrece oportunidades adicionales en minutos 08, 18,
28, 38, 48 y 58, y tras finalizar Supervisor CI en main. Solo llama al workflow
reutilizable; no hace dispatch ni necesita permisos de escritura. Rechaza eventos
de PR y repositorios ajenos, no descarga artefactos y ejecuta código de main.
La inspección conserva el token opcional para futuros repositorios; el caller de
recuperación pasa únicamente ese secreto opcional explícito, sin `secrets: inherit`; el alcance actual no cambia.

Ambas vías comparten `multiproject-supervisor` con `cancel-in-progress: false`.
Dentro de ese bloqueo se consulta el historial de los dos workflows y sus jobs:
solo un paso de inspección exitoso terminado hace menos de diez minutos evita
trabajo repetido. El run actual, gates omitidos y CI no son recibos. A los diez
minutos se permite otra inspección; tras fallo o interrupción se reintenta en la
siguiente oportunidad. No se reproduce cada intervalo perdido. El historial de
Actions actúa como registro persistente; no se escriben caches, issues ni ramas.

Errores de API, historial parcial y límite de paginación bloquean la decisión;
la siguiente oportunidad vuelve a comprobar. Concurrencia evita solapamientos,
pero GitHub puede reemplazar un run pendiente y la consistencia eventual de API
puede permitir una repetición secuencial. Las lecturas repetidas son idempotentes:
no hay efectos de escritura sobre repositorios. No se promete exactly-once.

Un cron auxiliar también depende del planificador de GitHub. Si GitHub no emite
ningún evento, la recuperación solo con Actions no puede garantizar un máximo de
15 minutos. Los recibos de recuperación no se cuentan como cron nativo: la auditoría
24h sigue filtrando exclusivamente `supervisor.yml` con evento `schedule`.
Ver [auditoría y matriz de consolidación](docs/AUDIT-2026-10-30.md).

Guía de activación, primeras 24 horas y reversión: [PRODUCTION.md](docs/PRODUCTION.md).
