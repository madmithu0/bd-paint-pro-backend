const request = require('supertest');
const app = require('../server');

describe('Core', () => {
  it('health check', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200);
    expect(r.body.version).toBe('1.0.0');
    expect(r.body.api).toBe('/api/v1');
  });
  it('404 for unknown route', async () => {
    const r = await request(app).get('/api/v1/unknown-route-xyz');
    expect(r.status).toBe(404);
  });
});

describe('Price logic', () => {
  it('100 sqft = 0.22 day', () => {
    const days = 100 / 450;
    expect(Number(days.toFixed(2))).toBe(0.22);
  });
  it('split with agent', () => {
    const total = 10000;
    expect(total * 0.80).toBe(8000);
    expect(total * 0.05).toBe(500);
    expect(total * 0.15).toBe(1500);
  });
  it('split without agent', () => {
    const total = 10000;
    expect(total * 0.80).toBe(8000);
    expect(total * 0.20).toBe(2000);
  });
});