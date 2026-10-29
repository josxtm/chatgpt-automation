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
