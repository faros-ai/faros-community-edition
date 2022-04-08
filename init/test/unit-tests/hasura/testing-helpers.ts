import {Endpoint, QueryCollection} from '../../../src/hasura/types';

export function getMetadata() {
  return {
    type: 'export_metadata',
    version: 2,
    args: {},
  };
}

export function addEndpoint(queryName: string, collectionName: string) {
  return {
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
  };
}

export function addQueryToCollection(
  queryName: string,
  collectionName: string
) {
  return {
    type: 'add_query_to_collection',
    args: {
      collection_name: collectionName,
      query_name: queryName,
      query: '',
    },
  };
}

export function createQueryCollection(queryCollection: QueryCollection) {
  return {
    type: 'create_query_collection',
    args: queryCollection,
  };
}

export function addCollectionToAllowlist(collectionName: string) {
  return {
    type: 'add_collection_to_allowlist',
    args: {
      collection: collectionName,
      scope: {
        global: true,
      },
    },
  };
}

export function makeRestEndpoint(queryName: string, collectionName: string) {
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

export function makeQueryCollection(
  queryName: string[],
  collectionName: string
) {
  return {
    definition: {
      queries: queryName.map((queryName) => {
        return {name: queryName, query: ''};
      }),
    },
    name: collectionName,
  };
}

export function makeMetadata(
  restEndpoints: Endpoint[],
  queryCollections: QueryCollection[]
) {
  return {
    metadata: {
      rest_endpoints: restEndpoints,
      query_collections: queryCollections,
    },
  };
}
