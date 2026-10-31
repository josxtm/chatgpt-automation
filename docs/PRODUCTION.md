# Producción: verificación operativa y reversión de la versión consolidada

## Estado de despliegue (actualizado el 2026-10-31)

El [PR #30](https://github.com/josxtm/chatgpt-automation/pull/30) **ya está
fusionado** en `main` desde el **2026-10-30 19:16:30 UTC**, commit
`03fb87c27b8fd26ad640a6d66b3144134fbe9d29`. No volver a ejecutar
las instrucciones de fusión como si el despliegue estuviera pendiente.

La ventana de observación postintegración es
**[2026-10-30T19:16:30Z, 2026-10-31T19:16:30Z)**. La auditoría independiente
del cron anterior al despliegue se documenta en el
[PR #35](https://github.com/josxtm/chatgpt-automation/pull/35) (en revisión);
no debe confundirse con la validación de esta nueva versión.

## Condiciones de seguridad

No integrar además los PR #18–#29: sus mejoras ya están consolidadas; dejarlos
abiertos hasta que su cierre sea autorizado. El PR #10 es obsoleto y no debe
fusionarse. No fusionar automáticamente los PR de documentación o mantenimiento.

El alcance sigue siendo exclusivamente `josxtm/chatgpt-automation`, con el check
`test`. No cambia configuración, ramas ni credenciales de MyCAD, CADCraft o
TELECONTROL. No hay Cloudflare ni servicios externos en el camino activo.
No se necesitan nuevos secretos; conservar los permisos de lectura declarados.
El token opcional existente no debe tener permisos de escritura y solo debe
abarcar los repositorios expresamente autorizados. No imprimirlo al comprobarlo.
Las políticas administrativas, cuotas y permisos reales de un token opcional
requieren revisión del propietario si la integración no permite consultarlos.

## Verificación posterior a la integración (sin nuevas fusiones)

1. Confirmar que `main` sigue apuntando al commit de integración registrado
   o a un descendiente conocido, y comprobar `Supervisor CI` para ese SHA.
   Usar como T0 **2026-10-30T19:16:30Z**. No repetir la fusión del PR #30.
2. Comprobar Supervisor CI de main. `Supervisor Recovery` debe aparecer activo;
   su evento workflow_run solo admite CI originado por push o workflow_dispatch
   en main y en este repositorio. No admite CI de PR, tampoco pull_request_target.
3. Revisar primero las ejecuciones reales ya observadas:
   [Supervisor CI #41113900643](https://github.com/josxtm/chatgpt-automation/actions/runs/41113900643),
   [Recovery #41113927799](https://github.com/josxtm/chatgpt-automation/actions/runs/41113927799)
   por `workflow_run`, y
   [Recovery #41141993763](https://github.com/josxtm/chatgpt-automation/actions/runs/41141993763)
   por `schedule`. Si se necesita otra prueba manual, ejecutar Supervisor
   Recovery desde `main`; no confundirla con una prueba de puntualidad del cron.
   Si la API devuelve 404, comprobar registro y permisos antes de reintentar.
4. Comprobar que al menos una inspección real termina correctamente. Un run
   verde con inspección omitida solo acredita supresión de trabajo reciente.
5. Lanzar una segunda ejecución manual cercana: debe mostrar recibo reciente e
   inspección omitida. Confirmar que ambas vías usan el mismo grupo global
   `multiproject-supervisor` y no se solapan. No cancelar trabajo productivo
   deliberadamente; comprobar recuperación tras fallos si estos aparecen.

El cron principal se mantiene `3-53/10 * * * *`; el auxiliar usa
`8-58/10 * * * *`. Ambos se evalúan en UTC desde main. No hay garantía de
puntualidad ni de entrega de todos los eventos. El job tiene timeout de cuatro
minutos; las peticiones HTTP tienen plazo de quince segundos y no hay bucles
ilimitados de reintentos. Otra oportunidad vuelve a intentar tras un fallo.

## Primeras 24 horas

Revisar a T0, aproximadamente T0+1h, +6h, +12h y +24h:

- Registrar IDs, eventos, SHA, estado, conclusión y pasos de ambos workflows.
  Separar inspecciones exitosas, fallidas y omitidas por el gate.
- Ante silencio del principal, comprobar que la recuperación hace una inspección
  cuando el recibo tenga diez minutos o más; no reproduce todos los ticks perdidos.
- Verificar exclusión mutua y ausencia de inspecciones repetidas mientras un
  recibo reciente sea visible. GitHub puede sustituir un run pendiente; no hay FIFO.
- Revisar 403, 404, 429, 5xx, timeout, historial parcial y límite de paginación.
  Nunca interpretar el fallo cerrado como confirmación de que todo está supervisado.
- Confirmar que el informe solo contiene el repositorio autorizado y que no hay
  fusiones, escrituras, credenciales expuestas ni permisos añadidos.
- Contabilizar por separado el cron nativo y la cobertura de inspecciones reales:
  una recuperación exitosa no convierte un hueco de schedule nativo en éxito.

Al cerrar exactamente 24 horas, ejecutar desde una copia del commit validado:

```bash
node scripts/audit-schedule.mjs START_UTC END_UTC
```

Usar T0 y T0+24h con formato `YYYY-MM-DDTHH:mm:ssZ` y un `GH_TOKEN` ya configurado
con actions:read. No introducir el token en la línea de comandos ni en el informe.
La auditoría pagina exclusivamente runs schedule del principal, cuenta intervalos
estrictamente mayores de quince minutos (15:00 tolerado, 15:01 detectado), y mide
silencios inicial/final por separado. Devuelve código 0 únicamente con ventana
cerrada, historial completo y sin huecos; ventanas abiertas, errores, datos
insuficientes o páginas incompletas nunca acreditan cadencia sana.
Los runs de recuperación se revisan en Actions y no se suman a esa auditoría.

## Límites y criterio de aceptación

Recomendada para despliegue supervisado por su alcance de lectura. No declarar
periodicidad estable ni recuperación validada en producción hasta completar las
comprobaciones anteriores. Si no llegan eventos de GitHub, ninguno de los dos
cron puede garantizar recuperación ni un SLA de quince minutos.

El gate usa recibos visibles en los pasos de jobs, con una ventana de diez minutos
desde su finalización. La búsqueda incluye starts hasta cinco minutos anteriores
a esa ventana. Ese margen cubre el timeout normal del job, pero no una espera
prolongada antes de arrancar. Un run creado hace más de quince minutos y terminado
recientemente puede no suprimir una lectura repetida. También la consistencia
eventual de la API puede permitir duplicados secuenciales. No hay garantía
exactly-once; las operaciones repetidas son lecturas sin efectos externos.

El límite de paginación, las cuotas y la retención de historial pueden impedir una
decisión: se falla cerrado y se revisa el error. No introducir permisos de escritura
para ocultarlo. Los recibos se identifican por nombre de paso: no renombrarlo sin
revisar simultáneamente gate, workflow y pruebas. La validación estática no sustituye
la observación posterior a la fusión.

## Reversión

Si hay exposición de secretos, escrituras inesperadas, trabajo solapado o fallos
persistentes del gate, el propietario debe deshabilitar manualmente **ambos**
workflows de supervisión en Actions; mantener Supervisor CI activo. Deshabilitar
solo el auxiliar no evita que el principal consulte su historial.

Preparar un PR de reversión del cambio integrado, conservando cambios posteriores:
con merge commit usar `git revert -m 1 MERGE_SHA`; con squash usar
`git revert SQUASH_SHA`. Con rebase, revertir los commits introducidos en orden
inverso. Hacerlo en una rama nueva basada en main actual; no resetear ni forzar main.
Ejecutar npm test, actionlint y Supervisor CI antes de fusionarlo manualmente.
Rehabilitar el principal tras restaurarlo y comprobar una ejecución manual.
La versión anterior tenía grandes huecos de cron; revertir no los soluciona.
No hay datos persistentes, migraciones ni recursos externos que deshacer.
