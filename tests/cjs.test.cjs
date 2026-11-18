'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('ReplyCraft - CommonJS Module Test', () => {
  test('imports named exports correctly via require', () => {
    const {
      AppError,
      responseHandler,
      errorHandler,
      asyncHandler,
      paginate,
      requestId
    } = require('../src/index.cjs');

    assert.equal(typeof AppError, 'function');
    assert.equal(typeof responseHandler, 'function');
    assert.equal(typeof errorHandler, 'function');
    assert.equal(typeof asyncHandler, 'function');
    assert.equal(typeof paginate, 'function');
    assert.equal(typeof requestId, 'function');
  });

  test('imports default object via require', () => {
    const replycraft = require('../src/index.cjs');

    assert.equal(typeof replycraft.paginate, 'function');
    assert.equal(typeof replycraft.responseHandler, 'function');
    assert.equal(typeof replycraft.errorHandler, 'function');
    assert.equal(typeof replycraft.asyncHandler, 'function');
    assert.equal(typeof replycraft.requestId, 'function');
    assert.equal(typeof replycraft.AppError, 'function');
  });
});
