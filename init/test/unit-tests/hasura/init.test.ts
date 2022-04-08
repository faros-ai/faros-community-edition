import axios from 'axios';
import nock from 'nock';
import path from 'path';
import pino from 'pino';

import {HasuraInit} from '../../../src/hasura/init';
import {
  addCollectionToAllowlist,
  addEndpoint,
  addQueryToCollection,
  createQueryCollection,
  getMetadata,
  makeMetadata,
  makeQueryCollection,
  makeRestEndpoint,
} from './testing-helpers';

describe('init', () => {
  const logger = pino({
    name: 'test',
    level: process.env.LOG_LEVEL ?? 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
      },
    },
  });

  const host = 'http://test.test.com';

  const hasura = new HasuraInit(
    axios.create({
      baseURL: host,
      headers: {'X-Hasura-Role': 'admin'},
    }),
    logger,
    path.join(__dirname, '..', '..', 'resources', 'hasura')
  );

  beforeEach(() => {
    nock.cleanAll();
  });

  test('Collection exists and query from resources is new', async () => {
    const requestBodies = [];
    const scope = nock(host)
      .persist()
      .post('/v1/metadata', (body) => {
        requestBodies.push(body);
        return body;
      })
      .reply(
        200,
        makeMetadata(
          [makeRestEndpoint('q1', 'allowed-queries')],
          [makeQueryCollection(['q1'], 'allowed-queries')]
        )
      );

    await hasura.createEndpoints();
    scope.done();

    expect(requestBodies).toStrictEqual([
      getMetadata(),
      addQueryToCollection('a', 'allowed-queries'),
      getMetadata(),
      addEndpoint('a', 'allowed-queries'),
    ]);
  });

  test('Empty metadata', async () => {
    const requestBodies = [];
    const scope = nock(host)
      .persist()
      .post('/v1/metadata', (body) => {
        requestBodies.push(body);
        return body;
      })
      .reply(200, makeMetadata([], []));

    await hasura.createEndpoints();
    scope.done();

    expect(requestBodies).toStrictEqual([
      getMetadata(),
      createQueryCollection(makeQueryCollection(['a'], 'allowed-queries')),
      addCollectionToAllowlist('allowed-queries'),
      getMetadata(),
      addEndpoint('a', 'allowed-queries'),
    ]);
  });

  test('Query from resources already exists', async () => {
    const requestBodies = [];
    const scope = nock(host)
      .persist()
      .post('/v1/metadata', (body) => {
        requestBodies.push(body);
        return body;
      })
      .reply(
        200,
        makeMetadata(
          [makeRestEndpoint('a', 'allowed-queries')],
          [makeQueryCollection(['a'], 'allowed-queries')]
        )
      );

    await hasura.createEndpoints();
    scope.done();

    expect(requestBodies).toStrictEqual([getMetadata(), getMetadata()]);
  });

  test('Adds endpoint', async () => {
    const requestBodies = [];
    const scope = nock(host)
      .persist()
      .post('/v1/metadata', (body) => {
        requestBodies.push(body);
        return body;
      })
      .reply(
        200,
        makeMetadata([], [makeQueryCollection(['a'], 'allowed-queries')])
      );

    await hasura.createEndpoints();
    scope.done();

    expect(requestBodies).toStrictEqual([
      getMetadata(),
      getMetadata(),
      addEndpoint('a', 'allowed-queries'),
    ]);
  });
});
