'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { simulate } = require('./helpers.js');
const {
  AppError,
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
} = require('../src/core.cjs');

describe('ReplyCraft - Express Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestId());
    app.use(responseHandler());
  });

  describe('res.success()', () => {
    test('returns standard success response with default 200', async () => {
      app.get('/test-success', (req, res) => {
        return res.success([{ id: 1, name: 'Alex' }], 'Users fetched successfully', 200, { total: 1 });
      });

      const res = await simulate(app, { method: 'GET', url: '/test-success' });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        success: true,
        message: 'Users fetched successfully',
        data: [{ id: 1, name: 'Alex' }],
        meta: { total: 1 }
      });
    });

    test('supports custom status code (201 Created)', async () => {
      app.post('/test-create', (req, res) => {
        return res.success({ id: 2, name: 'Sam' }, 'Created', 201);
      });

      const res = await simulate(app, { method: 'POST', url: '/test-create' });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Created');
      assert.deepEqual(res.body.data, { id: 2, name: 'Sam' });
      assert.equal(res.body.meta, undefined);
    });

    test('handles missing or undefined data gracefully as null', async () => {
      app.get('/test-empty-success', (req, res) => {
        return res.success();
      });

      const res = await simulate(app, { method: 'GET', url: '/test-empty-success' });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Success');
      assert.equal(res.body.data, null);
    });
  });

  describe('res.fail()', () => {
    test('returns standard fail response with default 400', async () => {
      app.get('/test-fail', (req, res) => {
        return res.fail('User not found', 400);
      });

      const res = await simulate(app, { method: 'GET', url: '/test-fail' });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, {
        success: false,
        message: 'User not found',
        data: null,
        error: {
          details: null
        }
      });
    });

    test('returns custom status and structured details', async () => {
      app.post('/test-fail-details', (req, res) => {
        return res.fail('Validation error', 422, { field: 'email', reason: 'invalid format' });
      });

      const res = await simulate(app, { method: 'POST', url: '/test-fail-details' });
      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Validation error');
      assert.equal(res.body.data, null);
      assert.deepEqual(res.body.error, {
        details: { field: 'email', reason: 'invalid format' }
      });
    });
  });

  describe('errorHandler middleware', () => {
    test('catches forwarded AppError with custom status and details', async () => {
      const errorApp = express();
      errorApp.use(responseHandler());
      errorApp.get('/test-app-error', (req, res, next) => {
        next(new AppError('Resource missing', 404, { resourceId: 42 }));
      });
      errorApp.use(errorHandler());

      const res = await simulate(errorApp, { method: 'GET', url: '/test-app-error' });
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, {
        success: false,
        message: 'Resource missing',
        data: null,
        error: {
          details: { resourceId: 42 }
        }
      });
    });

    test('masks 500 error in production environment', async () => {
      const prodApp = express();
      prodApp.use(responseHandler());
      prodApp.get('/crash', (req, res, next) => {
        const secretError = new Error('Database password incorrect in postgres://user:secret@db');
        next(secretError);
      });
      prodApp.use(errorHandler({ isProduction: true }));

      const res = await simulate(prodApp, { method: 'GET', url: '/crash' });
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Internal Server Error');
      assert.equal(res.body.data, null);
      assert.equal(res.body.error.details, null);
      assert.equal(res.body.stack, undefined);
    });

    test('can be mounted directly as app.use(errorHandler)', async () => {
      const directApp = express();
      directApp.get('/err', (req, res, next) => {
        next(new Error('Simple failure'));
      });
      directApp.use(errorHandler);

      const res = await simulate(directApp, { method: 'GET', url: '/err' });
      assert.equal(res.status, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.data, null);
      assert.equal(res.body.error.details, null);
    });
  });

  describe('asyncHandler integration', () => {
    test('routes async errors to errorHandler', async () => {
      const asyncApp = express();
      asyncApp.use(responseHandler());
      asyncApp.get(
        '/async-fail',
        asyncHandler(async (req, res) => {
          await Promise.resolve();
          throw new AppError('Async rejected', 403);
        })
      );
      asyncApp.use(errorHandler());

      const res = await simulate(asyncApp, { method: 'GET', url: '/async-fail' });
      assert.equal(res.status, 403);
      assert.equal(res.body.message, 'Async rejected');
    });
  });

  describe('requestId middleware', () => {
    test('generates uuid and attaches to req and res header', async () => {
      let capturedReqId = null;
      app.get('/id-check', (req, res) => {
        capturedReqId = req.id;
        return res.success({ id: req.id });
      });

      const res = await simulate(app, { method: 'GET', url: '/id-check' });
      assert.equal(res.status, 200);
      const headerVal = res.headers['x-request-id'];
      assert.ok(headerVal, 'Response should contain X-Request-ID header');
      assert.equal(headerVal, capturedReqId);
      assert.match(headerVal, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('accepts safe existing request ID from client', async () => {
      const clientTraceId = 'trace-client-12345';
      let capturedReqId = null;
      app.get('/id-check-custom', (req, res) => {
        capturedReqId = req.id;
        return res.success();
      });

      const res = await simulate(app, {
        method: 'GET',
        url: '/id-check-custom',
        headers: { 'X-Request-ID': clientTraceId }
      });

      assert.equal(res.headers['x-request-id'], clientTraceId);
      assert.equal(capturedReqId, clientTraceId);
    });

    test('replaces unsafe or excessively long request IDs', async () => {
      const unsafeId = 'invalid<script>alert(1)</script>';
      let capturedReqId = null;
      app.get('/id-check-unsafe', (req, res) => {
        capturedReqId = req.id;
        return res.success();
      });

      const res = await simulate(app, {
        method: 'GET',
        url: '/id-check-unsafe',
        headers: { 'X-Request-ID': unsafeId }
      });

      assert.notEqual(res.headers['x-request-id'], unsafeId);
      assert.match(res.headers['x-request-id'], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      assert.equal(capturedReqId, res.headers['x-request-id']);
    });
  });
});
