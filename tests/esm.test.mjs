import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import replycraft, {
  AppError,
  responseHandler,
  errorHandler,
  asyncHandler,
  paginate,
  requestId
} from '../src/index.mjs';

describe('ReplyCraft - ES Module Test', () => {
  test('imports named exports correctly via import', () => {
    assert.equal(typeof AppError, 'function');
    assert.equal(typeof responseHandler, 'function');
    assert.equal(typeof errorHandler, 'function');
    assert.equal(typeof asyncHandler, 'function');
    assert.equal(typeof paginate, 'function');
    assert.equal(typeof requestId, 'function');
  });

  test('imports default export object via import', () => {
    assert.equal(typeof replycraft.paginate, 'function');
    assert.equal(typeof replycraft.responseHandler, 'function');
    assert.equal(typeof replycraft.errorHandler, 'function');
    assert.equal(typeof replycraft.asyncHandler, 'function');
    assert.equal(typeof replycraft.requestId, 'function');
    assert.equal(typeof replycraft.AppError, 'function');
  });
});
