import jwt from 'jsonwebtoken';
import { env } from './env.js';

const ISSUER = 'bd-paint-pro';
const ALGORITHM = 'HS256';

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { issuer: ISSUER, algorithm: ALGORITHM, expiresIn: '1h' });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: ISSUER, algorithms: [ALGORITHM] });
}
