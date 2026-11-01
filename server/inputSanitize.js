import { logEvent } from './logger.js';

const ATTACK_PATTERNS = [
  /<\s*script/i,
  /javascript\s*:/i,
  /\bon[a-z]+\s*=/i,
  /\b(union\s+select|drop\s+table|insert\s+into|delete\s+from)\b/i,
  /<\?php/i,
  /\.\.\//,
  /\x00/,
];

function collectStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }
  return out;
}

export function inputSanitize(req, res, next) {
  const strings = collectStrings([req.body, req.query, req.params]);
  const malicious = strings.some((text) => ATTACK_PATTERNS.some((pattern) => pattern.test(text)));

  if (malicious) {
    logEvent('security', 'blocked_malicious_input', {
      ip: req.ip,
      details: { method: req.method, path: req.path },
    });
    return res.status(400).json({ error: 'The request contains content that is not allowed' });
  }

  return next();
}
