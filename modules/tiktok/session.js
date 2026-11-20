export function validateSession(input) {
  const sessionId = typeof input?.sessionId === 'string' ? input.sessionId.trim() : '';
  const ttTargetIdc = typeof input?.ttTargetIdc === 'string' ? input.ttTargetIdc.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,512}$/.test(sessionId)) throw new Error('Copia el valor completo de la cookie sessionid');
  if (!/^[a-zA-Z0-9-]{2,64}$/.test(ttTargetIdc)) throw new Error('Copia el valor de la cookie tt-target-idc');
  return { sessionId, ttTargetIdc };
}
