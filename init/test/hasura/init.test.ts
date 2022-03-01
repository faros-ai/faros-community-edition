import axios from 'axios';
import {mocked} from 'jest-mock';
import path from 'path';
import pino from 'pino';

import {HasuraInit} from '../../src/hasura/init';
import {Endpoint, QueryCollection} from '../../src/hasura/types';

jest.mock('axios');

describe('init', () => {
  const mockedAxios = mocked(axios, true);

  const logger = pino({
    name: 'hasura-init',
  });

  const hasura = new HasuraInit(
    axios,
    pino(logger),
    path.join(__dirname, '..', 'resources', 'hasura')
  );

  function getMetadata(callIndex: number) {
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      callIndex,
      '/v1/metadata',
      {
        type: 'export_metadata',
        version: 2,
        args: {},
      }
    );
  }

  function addEndpoint(
    callIndex: number,
    queryName: string,
    collectionName: string
  ) {
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      callIndex,
      '/v1/metadata',
      {
        type: 'create_rest_endpoint',
        args: {
          name: queryName,
          url: queryName,
          comment: null,
          methods: ['POST'],
          definition: {
            query: {
              query_name: queryName,
              collection_name: collectionName,
            },
          },
        },
      }
    );
  }

  function addQueryToCollection(
    callIndex: number,
    queryName: string,
    collectionName: string
  ) {
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      callIndex,
      '/v1/metadata',
      {
        type: 'add_query_to_collection',
        args: {
          collection_name: collectionName,
          query_name: queryName,
          query: '',
        },
      }
    );
  }

  function makeRestEndpoint(queryName: string, collectionName: string) {
    return {
      name: queryName,
      url: queryName,
      comment: null,
      methods: ['POST'],
      definition: {
        query: {
          query_name: queryName,
          collection_name: collectionName,
        },
      },
    };
  }

  function makeQueryCollection(queryName: string[], collectionName: string) {
    return {
      definition: {
        queries: queryName.map((queryName) => {
          return {name: queryName, query: ''};
        }),
      },
      name: collectionName,
    };
  }

  function makeMetadata(
    restEndpoints: Endpoint[],
    queryCollections: QueryCollection[]
  ) {
    return {
      data: {
        metadata: {
          rest_endpoints: restEndpoints,
          query_collections: queryCollections,
        },
      },
    };
  }

  function createQueryCollection(
    callIndex: number,
    queryCollection: QueryCollection
  ) {
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      callIndex,
      '/v1/metadata',
      {
        type: 'create_query_collection',
        args: queryCollection,
      }
    );
  }

  function addCollectionToAllowlist(callIndex: number, collectionName: string) {
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      callIndex,
      '/v1/metadata',
      {
        type: 'add_collection_to_allowlist',
        args: {
          collection: collectionName,
          scope: {
            global: true,
          },
        },
      }
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Collection exists and query from resources is new', async () => {
    mockedAxios.post.mockResolvedValue(
      makeMetadata(
        [makeRestEndpoint('q1', 'allowed-queries')],
        [makeQueryCollection(['q1'], 'allowed-queries')]
      )
    );

    await hasura.createEndpoints();

    expect(mockedAxios.post).toHaveBeenCalledTimes(4);
    getMetadata(1);
    addQueryToCollection(2, 'a', 'allowed-queries');
    getMetadata(3);
    addEndpoint(4, 'a', 'allowed-queries');
  });

  test('Empty metadata', async () => {
    mockedAxios.post.mockResolvedValue(makeMetadata([], []));

    await hasura.createEndpoints();

    expect(mockedAxios.post).toHaveBeenCalledTimes(5);
    getMetadata(1);
    createQueryCollection(2, makeQueryCollection(['a'], 'allowed-queries'));
    addCollectionToAllowlist(3, 'allowed-queries');
    getMetadata(4);
    addEndpoint(5, 'a', 'allowed-queries');
  });

  test('Query from resources already exists', async () => {
    mockedAxios.post.mockResolvedValue(
      makeMetadata(
        [makeRestEndpoint('a', 'allowed-queries')],
        [makeQueryCollection(['a'], 'allowed-queries')]
      )
    );

    await hasura.createEndpoints();

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    getMetadata(1);
    getMetadata(2);
  });

  test('Adds endpoint', async () => {
    mockedAxios.post.mockResolvedValue(
      makeMetadata([], [makeQueryCollection(['a'], 'allowed-queries')])
    );

    await hasura.createEndpoints();

    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    getMetadata(1);
    getMetadata(2);
    addEndpoint(3, 'a', 'allowed-queries');
  });
});
