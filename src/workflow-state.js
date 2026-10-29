// Read-only diagnostic: an active workflow is not proof that its cron fires.
export function assessWorkflowState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.path !== '.github/workflows/supervisor.yml') {
    return { state: 'unknown', reason: 'metadatos del workflow ausentes o inesperados' };
  }
  switch (data.state) {
    case 'active': return { state: 'active', reason: 'habilitado en GitHub' };
    case 'disabled_manually': return { state: 'disabled', reason: 'deshabilitado manualmente' };
    case 'disabled_inactivity': return { state: 'disabled', reason: 'deshabilitado por inactividad' };
    case 'disabled_fork': return { state: 'disabled', reason: 'deshabilitado en una bifurcación' };
    case 'deleted': return { state: 'unavailable', reason: 'workflow eliminado' };
    default: return { state: 'unknown', reason: 'estado no reconocido por el diagnóstico' };
  }
}

// Read-only guidance. A healthy CI check cannot establish cron delivery.
export function scheduleDiagnosticHint(workflowState, scheduleState) {
  if (workflowState === 'unknown') {
    return 'No se pudo confirmar si el workflow está habilitado: revisar el estado en Actions, los permisos actions:read y la disponibilidad de la API antes de confiar en el cron.';
  }
  if (workflowState === 'unavailable') {
    return 'GitHub indica que el workflow fue eliminado: comprobar que supervisor.yml existe en la rama predeterminada antes de esperar ejecuciones.';
  }
  if (workflowState === 'disabled') {
    return 'El workflow está deshabilitado: habilitarlo manualmente en Actions antes de esperar disparos schedule.';
  }
  if (workflowState === 'active' && scheduleState === 'unknown') {
    return 'Workflow habilitado, pero el historial schedule no es verificable: revisar permisos actions:read, respuesta de la API y metadatos de ejecuciones.';
  }
  if (workflowState === 'active' && scheduleState === 'in-progress') {
    return 'El último disparo schedule sigue pendiente o en curso: revisar cola y jobs; aún no se conoce su resultado.';
  }
  if (workflowState === 'active' && scheduleState === 'never-seen') {
    return 'Workflow habilitado, pero sin disparos schedule registrados: revisar Actions, rama predeterminada y restricciones de GitHub; no confundir una ejecución manual verde con el cron.';
  }
  if (workflowState === 'active' && scheduleState === 'recent-not-green') {
    return 'Se registró un disparo schedule que no terminó en verde: abrir la ejecución indicada y revisar los jobs y logs.';
  }
  if (workflowState === 'active' && scheduleState === 'stale-in-progress') {
    return 'El último disparo schedule es antiguo y sigue pendiente o en curso: revisar la cola, concurrencia y jobs de Actions, además de posibles retrasos.';
  }
  if (workflowState === 'active' && scheduleState === 'stale-not-green') {
    return 'El último disparo schedule es antiguo y no terminó en verde: revisar los jobs y logs de esa ejecución, además de los posibles retrasos de GitHub Actions.';
  }
  if (workflowState === 'active' && scheduleState === 'stale') {
    return 'El último disparo schedule es antiguo: revisar retrasos o interrupciones de GitHub Actions sin asumir una cadencia garantizada.';
  }
  return null;
}

// Separate cadence guidance: a recent successful run can coexist with large gaps.
export function cadenceDiagnosticHint(cadence) {
  if (!cadence || typeof cadence !== 'object') {
    return 'No se pudo evaluar la cadencia: revisar la respuesta de Actions antes de asumir regularidad.';
  }
  if (cadence.state === 'unknown') {
    return 'La muestra de cadencia no es verificable: revisar metadatos, orden de ejecuciones y respuesta de la API de Actions.';
  }
  if (cadence.state === 'gaps' ||
      (cadence.state === 'insufficient-data' && cadence.gaps > 0)) {
    return 'Se observaron huecos de más de diez minutos entre disparos schedule: revisar el historial de Actions y posibles retrasos u omisiones del planificador; un CI verde no garantiza el cron.';
  }
  if (cadence.state === 'insufficient-data') {
    return 'Hay pocos disparos schedule para evaluar la cadencia: continuar observando el historial sin dar por fiable la programación.';
  }
  return null;
}

// A successful last run can still be too old for a five-minute schedule.
// This is an observation, not proof of a GitHub scheduling failure.
export function scheduleSilenceHint(health, thresholdMinutes = 10) {
  if (!health || health.state !== 'observed' ||
      !Number.isFinite(health.ageMinutes) || health.ageMinutes < 0 ||
      !Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) return null;
  if (health.ageMinutes <= thresholdMinutes) return null;
  return `El último disparo schedule terminó en verde, pero no hay uno más reciente desde hace más de ${thresholdMinutes} minutos: revisar el historial de Actions y posibles retrasos del planificador; un CI verde no confirma la periodicidad.`;
}
