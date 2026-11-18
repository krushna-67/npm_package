'use strict';

const http = require('node:http');
const { PassThrough } = require('node:stream');

/**
 * Dispatches a simulated HTTP request to an Express application in memory.
 * This avoids TCP port binding restrictions while executing the full Express pipeline.
 *
 * @param {import('express').Express} app - Express application instance
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {string} [options.url='/']
 * @param {Record<string, string>} [options.headers={}]
 * @param {any} [options.body=null]
 * @returns {Promise<{ statusCode: number, status: number, headers: Record<string, string>, body: any }>}
 */
function simulate(app, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const socket = new PassThrough();
      const req = new http.IncomingMessage(socket);
      req.method = method.toUpperCase();
      req.url = url;

      const normalizedHeaders = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
      );

      let payloadBuffer = null;
      if (body !== null && body !== undefined) {
        const payloadString = typeof body === 'string' ? body : JSON.stringify(body);
        payloadBuffer = Buffer.from(payloadString);
        if (!normalizedHeaders['content-type']) {
          normalizedHeaders['content-type'] = 'application/json';
        }
        normalizedHeaders['content-length'] = payloadBuffer.length.toString();
      }

      req.headers = normalizedHeaders;

      const res = new http.ServerResponse(req);
      const chunks = [];

      res.write = function (chunk, encoding, callback) {
        if (chunk) chunks.push(Buffer.from(chunk));
        if (typeof callback === 'function') callback();
        return true;
      };

      res.end = function (chunk, encoding, callback) {
        if (chunk) chunks.push(Buffer.from(chunk));
        if (typeof callback === 'function') callback();

        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }

        resolve({
          statusCode: res.statusCode,
          status: res.statusCode,
          headers: res.getHeaders(),
          body: parsedBody
        });
      };

      app.handle(req, res);

      if (payloadBuffer !== null) {
        req.push(payloadBuffer);
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { simulate };
