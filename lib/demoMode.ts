export function isDemoMode() {
  const value = process.env.DIRECTOR_WORKSPACE_DEMO_MODE?.trim().toLowerCase();

  if (!value) return false;

  return !["0", "false", "no", "off", "disabled"].includes(value);
}

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on", "enabled"].includes(
    value?.trim().toLowerCase() ?? "",
  );
}

export function shouldAllowCustomApiConfig() {
  return !isDemoMode() || isEnabled(process.env.DIRECTOR_WORKSPACE_ALLOW_CUSTOM_API);
}

export function areReferenceUploadsEnabled() {
  return !isDemoMode() || isEnabled(process.env.DIRECTOR_WORKSPACE_ENABLE_UPLOADS);
}

export function isDemoRateLimitEnabled() {
  const value = process.env.DIRECTOR_WORKSPACE_RATE_LIMIT_ENABLED?.trim()
    .toLowerCase();

  if (!value) return true;

  return !["0", "false", "no", "off", "disabled"].includes(value);
}

export function getDemoRateLimitMax() {
  const parsed = Number(process.env.DIRECTOR_WORKSPACE_RATE_LIMIT_MAX_PER_HOUR);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100;
}

export function getDemoRateLimitWindowMs() {
  return 60 * 60 * 1000;
}
