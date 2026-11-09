const os = require('os');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

// All legacy API tests use a disposable database, never database.sqlite.
const ownsTestDatabase = !process.env.DATABASE_PATH;
if (ownsTestDatabase) {
  process.env.DATABASE_PATH = path.join(os.tmpdir(), `flower-shop-tests-${process.pid}-${Date.now()}.sqlite`);
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
const app = require('../app');
const db = require('../src/database');

if (!global.__flowerTestCleanupRegistered) {
  global.__flowerTestCleanupRegistered = true;
  process.on('exit', () => {
    try { db.close(); } catch (_) {}
    if (ownsTestDatabase) {
      for (const suffix of ['', '-shm', '-wal']) {
        try { fs.rmSync(process.env.DATABASE_PATH + suffix, { force: true }); } catch (_) {}
      }
    }
  });
}

/**
 * Login with the seed admin account and return the JWT token.
 */
async function getAdminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@hexschool.com', password: '12345678' });
  return res.body.data.token;
}

/**
 * Register a new user and return { token, user }.
 */
async function registerUser(overrides = {}) {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: overrides.password || 'password123',
      name: overrides.name || '測試使用者',
    });
  return { token: res.body.data.token, user: res.body.data.user };
}

module.exports = { app, request, getAdminToken, registerUser };
