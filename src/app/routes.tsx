// Route components are declared in App.tsx so the prototype can be dropped into a
// host shell later. This file is kept as the intended replacement boundary for
// a route manifest or server-side route registration.
export const routePaths = ['/', '/dashboard', '/simulator', '/simulation/:scenarioId', '/events', '/analytics', '/architecture', '/limitations'] as const
