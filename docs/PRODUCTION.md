# Activación y reversión de la versión consolidada

## Condiciones previas

Revisar manualmente PR #30 y Supervisor CI verde en su SHA final. No integrar
además #18–#29: sus mejoras están consolidadas; dejarlos abiertos hasta que su
cierre sea autorizado. #10 es obsoleto y no debe fusionarse.

El alcance sigue siendo exclusivamente `josxtm/chatgpt-automation`, con el check
`test`. No cambia configuración, ramas ni credenciales de MyCAD, CADCraft o
TELECONTROL. No hay Cloudflare ni servicios externos en el camino activo.
No se necesitan nuevos secretos; conservar los permisos de lectura declarados.
El token opcional existente no debe tener permisos de escritura y solo debe
abarcar los repositorios expresamente autorizados. No imprimirlo al comprobarlo.
Las políticas administrativas, cuotas y permisos reales de un token opcional
requieren revisión del propietario si la integración no permite consultarlos.

## Activación manual

1. Fusionar PR #30 manualmente, después de comprobar de nuevo el SHA y CI.
   Registrar el SHA de main anterior, el commit de integración y la hora UTC T0.
2. Comprobar Supervisor CI de main. `Supervisor Recovery` debe aparecer activo;
   su evento workflow_run solo admite CI originado por push o workflow_dispatch
   en main y en este repositorio. No admite CI de PR, tampoco pull_request_target.
3. Ejecutar manualmente Supervisor Recovery desde main para registrar y probar
   el workflow nuevo. Si la API del workflow todavía devuelve 404, esperar a su
   registro en Actions y repetir. El gate falla cerrado, no supone historial vacío.
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
