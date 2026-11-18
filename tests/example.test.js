'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { simulate } = require('./helpers.js');
const app = require('../examples/express-server.js');

describe('ReplyCraft - Example Server Tests', () => {
  test('GET /users returns all users with 200', async () => {
    const res = await simulate(app, { method: 'GET', url: '/users' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 6);
    assert.ok(res.headers['x-request-id']);
  });

  test('GET /users/:id returns user when found', async () => {
    const res = await simulate(app, { method: 'GET', url: '/users/1' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, 1);
  });

  test('GET /users/:id returns 404 when not found', async () => {
    const res = await simulate(app, { method: 'GET', url: '/users/999' });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.data, null);
    assert.deepEqual(res.body.error, { details: { requestedId: '999' } });
  });

  test('POST /users creates user with 201', async () => {
    const res = await simulate(app, {
      method: 'POST',
      url: '/users',
      body: { name: 'Grace Hopper', email: 'grace@navy.mil' }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'Grace Hopper');
  });

  test('POST /users validates required fields with 400', async () => {
    const res = await simulate(app, {
      method: 'POST',
      url: '/users',
      body: { name: '' }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.details.field, 'name');
  });

  test('GET /paginated-users returns paginated results', async () => {
    const res = await simulate(app, { method: 'GET', url: '/paginated-users?page=1&limit=2' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 2);
    assert.equal(res.body.meta.hasNextPage, true);
  });

  test('GET /error triggers centralized errorHandler with 503', async () => {
    const res = await simulate(app, { method: 'GET', url: '/error' });
    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Simulated upstream service outage');
    assert.deepEqual(res.body.error.details, {
      service: 'payment-gateway',
      retryAfterSeconds: 30
    });
  });
});
