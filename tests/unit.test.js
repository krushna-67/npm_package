'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  AppError,
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
} = require('../src/core.cjs');

describe('ReplyCraft - Unit Tests', () => {
  describe('paginate utility', () => {
    const dataset = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
      { id: 4, name: 'David' },
      { id: 5, name: 'Eve' }
    ];

    test('paginates first page correctly', () => {
      const result = paginate(dataset, 1, 2);
      assert.deepEqual(result.data, [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]);
      assert.deepEqual(result.pagination, {
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false
      });
    });

    test('paginates middle page correctly', () => {
      const result = paginate(dataset, 2, 2);
      assert.deepEqual(result.data, [
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'David' }
      ]);
      assert.equal(result.pagination.hasNextPage, true);
      assert.equal(result.pagination.hasPreviousPage, true);
    });

    test('paginates last page correctly with remainder', () => {
      const result = paginate(dataset, 3, 2);
      assert.deepEqual(result.data, [{ id: 5, name: 'Eve' }]);
      assert.equal(result.pagination.hasNextPage, false);
      assert.equal(result.pagination.hasPreviousPage, true);
    });

    test('supports empty array', () => {
      const result = paginate([], 1, 10);
      assert.deepEqual(result.data, []);
      assert.deepEqual(result.pagination, {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      });
    });

    test('does not mutate source array', () => {
      const clone = [...dataset];
      paginate(clone, 1, 2);
      assert.deepEqual(clone, dataset);
    });

    test('accepts string numbers for page and limit', () => {
      const result = paginate(dataset, '2', '2');
      assert.equal(result.pagination.page, 2);
      assert.equal(result.pagination.limit, 2);
    });

    test('throws TypeError if items is not an array', () => {
      assert.throws(() => paginate(null, 1, 10), {
        name: 'TypeError'
      });
      assert.throws(() => paginate('string', 1, 10), {
        name: 'TypeError'
      });
    });

    test('throws RangeError for invalid page numbers', () => {
      assert.throws(() => paginate(dataset, 0, 10), {
        name: 'RangeError'
      });
      assert.throws(() => paginate(dataset, -1, 10), {
        name: 'RangeError'
      });
      assert.throws(() => paginate(dataset, 'abc', 10), {
        name: 'RangeError'
      });
    });

    test('throws RangeError for invalid limit numbers', () => {
      assert.throws(() => paginate(dataset, 1, 0), {
        name: 'RangeError'
      });
      assert.throws(() => paginate(dataset, 1, -5), {
        name: 'RangeError'
      });
      assert.throws(() => paginate(dataset, 1, 'invalid'), {
        name: 'RangeError'
      });
    });
  });

  describe('asyncHandler utility', () => {
    test('throws error if argument is not a function', () => {
      assert.throws(() => asyncHandler(null), {
        name: 'TypeError'
      });
    });

    test('forwards rejected async error to next', async () => {
      const expectedError = new Error('Async failure');
      const asyncRoute = asyncHandler(async () => {
        throw expectedError;
      });

      let receivedError = null;
      const req = {};
      const res = { headersSent: false };
      const next = (err) => {
        receivedError = err;
      };

      await asyncRoute(req, res, next);
      assert.equal(receivedError, expectedError);
    });

    test('catches synchronous exception and forwards to next', () => {
      const expectedError = new Error('Sync throw');
      const syncRoute = asyncHandler(() => {
        throw expectedError;
      });

      let receivedError = null;
      const req = {};
      const res = { headersSent: false };
      const next = (err) => {
        receivedError = err;
      };

      syncRoute(req, res, next);
      assert.equal(receivedError, expectedError);
    });

    test('does not forward error if headers already sent', async () => {
      const asyncRoute = asyncHandler(async (req, res) => {
        res.headersSent = true;
        throw new Error('Late failure');
      });

      let nextCalled = false;
      const req = {};
      const res = { headersSent: false };
      const next = () => {
        nextCalled = true;
      };

      await asyncRoute(req, res, next);
      assert.equal(nextCalled, false);
    });
  });

  describe('AppError class', () => {
    test('creates custom error with status and details', () => {
      const details = { field: 'username', issue: 'taken' };
      const err = new AppError('Conflict detected', 409, details);
      assert.equal(err.name, 'AppError');
      assert.equal(err.message, 'Conflict detected');
      assert.equal(err.statusCode, 409);
      assert.deepEqual(err.details, details);
      assert.equal(err.isOperational, true);
    });
  });
});
