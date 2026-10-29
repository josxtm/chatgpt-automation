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

- Cada ejecución de **Multiproject Supervisor** consulta en modo lectura el último run cuyo evento sea `schedule` mediante la API de GitHub Actions.
- El informe distingue: `never-seen` (ningún disparo programado), `stale` (último disparo hace más de 45 minutos), `in-progress`, `recent-not-green`, `observed` y `unknown`.
- El diagnóstico es **informativo** y no modifica repositorios ni fusiona PR; un fallo al consultar el historial no bloquea la inspección de PR.
- El permiso adicional `actions: read` se limita a lectura. Una ejecución manual verde no prueba el cron; un único `observed` tampoco demuestra periodicidad sostenida.
- Si el historial muestra `never-seen`, revisar el estado de habilitación del workflow y las restricciones de Actions en GitHub. El cron sigue siendo best-effort.

## v0.8 — Diagnóstico del estado del workflow (PR de revisión)

- El resumen consulta en **solo lectura** el endpoint de GitHub Actions para saber si `Multiproject Supervisor` está habilitado, deshabilitado manualmente, deshabilitado por inactividad, deshabilitado en un fork o eliminado.
- Un estado `active` **no demuestra** que GitHub haya ejecutado el cron. El historial de disparos `schedule` se sigue mostrando de forma independiente.
- Si el workflow está deshabilitado, el informe indica que hay que habilitarlo en Actions; **no cambia la configuración ni activa nada automáticamente**.
- Si GitHub no permite consultar el estado, se muestra `unknown` sin detener la inspección de PR. El token solo necesita `actions: read`, ya configurado.
- Pruebas unitarias cubren estados activos, deshabilitados, eliminados y metadatos inesperados. No se activan servicios externos ni Cloudflare.

### Guía de diagnóstico combinada (v0.8)

- Si el workflow está **disabled**, el resumen indica que debe habilitarse manualmente; no se cambia su estado automáticamente.
- Si está **active** pero el historial indica **never-seen**, el resumen recuerda comprobar Actions, la rama predeterminada y las restricciones de GitHub. Un CI verde no demuestra que el cron se haya ejecutado.
- Si está **active** y el historial indica **stale**, se indica que se revisen posibles retrasos de GitHub Actions, sin prometer una cadencia exacta.
- Si está **active** y aparece **recent-not-green**, el resumen recomienda abrir el run programado y revisar sus jobs y logs.
- Si el workflow figura como **unavailable** (eliminado), el resumen recomienda comprobar su presencia en la rama predeterminada.
- La orientación es informativa y se prueba con funciones puras; no añade permisos ni operaciones de escritura.

### Mejora de diagnóstico de cadencia (v0.8, en revisión)

- Se consultan hasta **12 disparos reales `schedule`** en una sola lectura de Actions, sin cambiar el cron ni añadir permisos.
- El resumen muestra cuántos disparos se observaron, cuántos intervalos superaron **10 minutos** y el mayor intervalo de la muestra.
- Con menos de tres disparos indica `insufficient-data`; ante datos malformados indica `unknown`. Un historial sin huecos grandes **no demuestra fiabilidad futura**, y la antigüedad del último disparo se informa por separado.
- Se añaden pruebas para intervalos normales, retrasos, datos insuficientes y metadatos inconsistentes.
- Los estados de ejecución no reconocidos se clasifican como `unknown` incluso cuando el disparo es antiguo; la antigüedad no debe ocultar metadatos inválidos.

### Diagnóstico combinado de antigüedad y fallo (v0.8, en revisión)

- Si el último disparo programado terminó sin éxito **y** tiene más de 45 minutos, se informa `stale-not-green` en vez de ocultar el fallo bajo `stale`.
- El resumen recomienda inspeccionar los **jobs y logs** de la ejecución fallida, además de revisar posibles retrasos del planificador.
- Un disparo reciente no satisfactorio sigue figurando como `recent-not-green`; un disparo antiguo satisfactorio sigue figurando como `stale`. Son diagnósticos informativos, sin escrituras ni cambios de cron.
- Las pruebas cubren fallos antiguos y conclusiones ausentes para evitar falsos positivos.

### Diagnóstico de ejecuciones pendientes antiguas (v0.8, en revisión)

- Si el último disparo `schedule` tiene más de 45 minutos y sigue `queued`, `in_progress`, `waiting`, `pending` o `requested`, se informa `stale-in-progress` en lugar de ocultar el estado pendiente bajo `stale`.
- El resumen aconseja revisar la cola, concurrencia y jobs de GitHub Actions. No cancela ni reintenta ejecuciones automáticamente.
- Se incluyen pruebas para los cinco estados pendientes; se conserva el modo solo lectura y no se modifica el cron.

### Localización temporal del mayor hueco (v0.8, en revisión)

- Cuando se detectan intervalos de más de diez minutos entre disparos `schedule`, el resumen identifica en UTC el inicio y el final del **mayor hueco observado** de la muestra.
- Es un diagnóstico informativo: no cambia el cron, no garantiza periodicidad, no requiere permisos nuevos y no realiza escrituras.
- `npm test` verifica las marcas de tiempo del intervalo máximo en muestras regulares y con retrasos.

### Validación de conclusiones de ejecuciones (v0.8, en revisión)

- Si GitHub devuelve una conclusión desconocida para un disparo `schedule` completado, el diagnóstico informa `unknown` en lugar de afirmar que ha fallado; también se aplica cuando el disparo es antiguo.
- Las conclusiones reconocidas sin éxito (`failure`, `cancelled`, `skipped`, `timed_out`, `neutral`, `action_required`, `startup_failure`, `stale`) siguen apareciendo como `recent-not-green` o `stale-not-green` según la antigüedad.
- Una conclusión nula nunca se considera verde. Se añaden pruebas de entradas malformadas; no cambian permisos, cron, acciones de escritura ni Cloudflare.

### Orientación ante diagnósticos incompletos (v0.8, en revisión)

- Cuando GitHub no permite confirmar el estado de habilitación del workflow (`unknown`), el resumen recomienda comprobar Actions, permisos `actions:read` y disponibilidad de la API. **No se presupone que el cron funciona**.
- Si el workflow está activo pero el historial de disparos es `unknown`, se recomienda revisar la respuesta de la API y los metadatos de ejecuciones.
- Si el último disparo está `in-progress`, se informa de que todavía no tiene conclusión y se recomienda revisar cola y jobs.
- Solo se amplían mensajes y pruebas; no cambian el cron, los permisos, la configuración multiproyecto ni se habilita Cloudflare.

### Visibilidad de huecos con solo dos disparos (v0.8, en revisión)

- Si GitHub solo ha registrado **dos** ejecuciones `schedule`, el diagnóstico mantiene `insufficient-data` (no demuestra una cadencia estable), pero **no oculta** el intervalo entre ambas.
- El Summary muestra la duración del hueco y sus marcas de tiempo UTC cuando supera 10 minutos, incluso con una muestra de solo dos disparos.
- Con un solo disparo no se inventa ningún intervalo. Se añaden pruebas para ambos casos; sin cambios en cron, permisos ni acciones de escritura.

### Recomendaciones específicas de cadencia (v0.8, en revisión)

- Si hay intervalos observados de más de diez minutos entre disparos `schedule`, el Summary recomienda revisar retrasos u omisiones del planificador, **aunque el último disparo haya terminado correctamente**.
- Con solo dos disparos se muestra la advertencia sobre huecos reales sin afirmar que la muestra sea suficiente para evaluar la regularidad.
- Ante una muestra inconsistente se recomienda revisar los metadatos de Actions; con pocos disparos sin huecos se pide continuar observando.
- Son mensajes informativos de solo lectura, probados con funciones puras. No cambian permisos, cron, ramas, Cloudflare ni la política de fusiones manuales.

### Aviso temprano de silencio del cron (v0.8, en revisión)

- Si el último disparo `schedule` terminó correctamente y han pasado **más de diez minutos** sin otro disparo, el Summary muestra un aviso aunque todavía no se alcance el umbral de `stale` (45 minutos).
- El aviso es informativo: una ejecución verde no acredita regularidad y GitHub puede retrasar u omitir disparos. No se modifica el cron ni se reintenta nada automáticamente.
- Pruebas cubren el umbral exacto, ausencia de datos y estados que ya tienen un diagnóstico específico. Sin nuevos permisos, servicios externos ni escrituras.

### Ventana temporal de la muestra (v0.8, en revisión)

- El Summary muestra las fechas UTC del primer y último disparo `schedule` dentro de la muestra consultada, incluso si solo hay un disparo.
- Esta ventana permite interpretar los intervalos observados y evita confundir una muestra corta con una supervisión continua. No modifica el cron, permisos ni servicios externos.
- Se añaden pruebas de los límites temporales con uno, dos y tres disparos.

### Validación de metadatos pendientes y umbrales (v0.8, en revisión)

- Si GitHub marca un disparo `schedule` como pendiente o en ejecución pero le asigna una conclusión final, el supervisor muestra `unknown`: esos metadatos contradictorios no se interpretan como un estado normal.
- La advertencia de ausencia de nuevos disparos muestra el umbral realmente utilizado, incluso si se configura uno distinto de diez minutos; las pruebas cubren ambos casos.
- Son cambios de diagnóstico de solo lectura: no alteran el cron, los permisos, los repositorios supervisados ni Cloudflare.
