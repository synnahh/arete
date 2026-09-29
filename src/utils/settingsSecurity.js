const SERVER_ONLY_KEYS = new Set([
  'apiKey', 'claudeApiKey', 'claudeKey',
  'elevenlabsKey', 'azureKey',
  'twilioAccountSid', 'twilioAuthToken',
  'googleSearchKey', 'exerciseDbKey', 'finnhubKey',
]);

export function stripLegacyClaudeKeys(settings = {}) {
  const { apiKey: _api, claudeApiKey: _claudeApi, claudeKey: _claude, ...safe } = settings || {};
  return safe;
}

export function settingsForSync(settings = {}) {
  const safe = JSON.parse(JSON.stringify(settings || {}));
  for (const key of SERVER_ONLY_KEYS) delete safe[key];
  if (safe.voice && typeof safe.voice === 'object') {
    for (const key of SERVER_ONLY_KEYS) delete safe.voice[key];
  }
  return safe;
}
