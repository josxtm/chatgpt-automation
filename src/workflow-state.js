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
  if (workflowState === 'unavailable') {
    return 'GitHub indica que el workflow fue eliminado: comprobar que supervisor.yml existe en la rama predeterminada antes de esperar ejecuciones.';
  }
  if (workflowState === 'disabled') {
    return 'El workflow está deshabilitado: habilitarlo manualmente en Actions antes de esperar disparos schedule.';
  }
  if (workflowState === 'active' && scheduleState === 'never-seen') {
    return 'Workflow habilitado, pero sin disparos schedule registrados: revisar Actions, rama predeterminada y restricciones de GitHub; no confundir una ejecución manual verde con el cron.';
  }
  if (workflowState === 'active' && scheduleState === 'recent-not-green') {
    return 'Se registró un disparo schedule que no terminó en verde: abrir la ejecución indicada y revisar los jobs y logs.';
  }
  if (workflowState === 'active' && scheduleState === 'stale-not-green') {
    return 'El último disparo schedule es antiguo y no terminó en verde: revisar los jobs y logs de esa ejecución, además de los posibles retrasos de GitHub Actions.';
  }
  if (workflowState === 'active' && scheduleState === 'stale') {
    return 'El último disparo schedule es antiguo: revisar retrasos o interrupciones de GitHub Actions sin asumir una cadencia garantizada.';
  }
  return null;
}
