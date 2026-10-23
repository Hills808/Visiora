import { POLICY } from './config.mjs';

/** Provider metadata only. Never infer a model from generated text or the requested alias. */
export function inspectResponseModel(value) {
  const missing = value === undefined || value === null;
  const valid =
    typeof value === 'string' &&
    value.trim() === value &&
    value.length <= POLICY.maxModelIdLength &&
    /^[a-z0-9][a-z0-9._-]*$/.test(value) &&
    !value.startsWith('sk-');
  return {
    requestedModel: POLICY.model,
    returnedModel: valid ? value : null,
    verification: missing
      ? 'missing'
      : !valid
        ? 'invalid'
        : value === POLICY.model
          ? 'verified'
          : 'mismatch',
  };
}
