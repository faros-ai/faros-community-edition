import {AxiosInstance} from 'axios';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {Dictionary} from 'lodash';
import path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'airbytev40-init',
  level: process.env.LOG_LEVEL || 'info',
});

import {BASE_RESOURCES_DIR} from '../config';
const CATALOGS = path.join(
  BASE_RESOURCES_DIR,
  'airbyte',
  'workspace',
  'airbyte_config',
  'STANDARD_SYNC.yaml'
);
const SOURCES = path.join(
  BASE_RESOURCES_DIR,
  'airbyte',
  'workspace',
  'airbyte_config',
  'SOURCE_CONNECTION.yaml'
);
// Function to load and parse a YAML file
function loadYamlFile(filePath: string): any {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.load(fileContent);
    return data;
  } catch (error) {
    console.error(`Error loading YAML file: ${error}`);
    return null;
  }
}

// Function to find an entry with a specific attribute value
function findEntryWithAttributeValue(
  data: any[],
  attribute: string,
  value: any
): any {
  return data.find((entry) => entry[attribute] === value);
}

function snakeCaseToCamelCase(snakeCaseStr: string): string {
  return snakeCaseStr.replace(/_([a-z])/g, (match, letter) =>
    letter.toUpperCase()
  );
}

function convertKeysToCamelCase(data: any): any {
  if (Array.isArray(data)) {
    return data.map(convertKeysToCamelCase);
  } else if (data !== null && typeof data === 'object') {
    const newData: {[key: string]: any} = {};
    for (const key in data) {
      const camelCaseKey = snakeCaseToCamelCase(key);
      newData[camelCaseKey] = convertKeysToCamelCase(data[key]);
    }
    return newData;
  }
  return data;
}

export class AirbyteInitV40 {
  private readonly api: AxiosInstance;

  constructor(api: AxiosInstance) {
    this.api = api;
  }

  async createWorkspace(params: {name: string}): Promise<string> {
    const response = await this.api.post('/workspaces/create', params);
    return response.data.workspaceId as string;
  }

  async getWorkspaceBySlug(params: {slug: string}): Promise<string> {
    const response = await this.api.post('/workspaces/get_by_slug', params);
    return response.data.workspaceId as string;
  }

  async getFirstWorkspace(): Promise<string> {
    const response = await this.api.post('/workspaces/list', {});
    return response.data.workspaces[0].workspaceId as string;
  }

  // extra settings appear to be needed
  async completeWorkspaceSetup(params: {
    workspaceId: string;
    initialSetupComplete: boolean;
    anonymousDataCollection: boolean;
    news: boolean;
    securityUpdates: boolean;
  }): Promise<string> {
    const response = await this.api.post('/workspaces/update', params);
    return response.data.initialSetupComplete as string;
  }
  async createCustomSourceDefinition(params: {
    workspaceId: string;
    sourceDefinition: {
      name: string;
      dockerRepository: string;
      dockerImageTag: string;
      documentationUrl: string;
    };
  }): Promise<string> {
    const response = await this.api.post(
      '/source_definitions/create_custom',
      params
    );
    return response.data.sourceDefinitionId as string;
  }

  async createCustomDestinationDefinition(params: {
    workspaceId: string;
    destinationDefinition: {
      name: string;
      dockerRepository: string;
      dockerImageTag: string;
      documentationUrl: string;
    };
  }): Promise<string> {
    const response = await this.api.post(
      '/destination_definitions/create_custom',
      params
    );
    return response.data.destinationDefinitionId as string;
  }

  async createSource(params: {
    sourceDefinitionId: string;
    connectionConfiguration: Dictionary<any>;
    workspaceId: string;
    name: string;
  }): Promise<string> {
    const response = await this.api.post('/sources/create', params);
    return response.data.sourceId as string;
  }

  async createDestination(params: {
    destinationDefinitionId: string;
    connectionConfiguration: Dictionary<any>;
    workspaceId: string;
    name: string;
  }): Promise<string> {
    const response = await this.api.post('/destinations/create', params);
    return response.data.destinationId as string;
  }

  async listDestinationNames(params: {workspaceId: string}): Promise<string[]> {
    const response = await this.api.post('/destinations/list', params);
    return response.data.destinations.map(
      (destination: any) => destination.name
    ) as string[];
  }

  async getCatalog(params: {sourceId: string}): Promise<Dictionary<any>> {
    const response = await this.api.post('/sources/discover_schema', params);
    return response.data.catalog;
  }

  async createConnection(params: {
    name: string;
    prefix: string;
    sourceId: string;
    destinationId: string;
    syncCatalog: Dictionary<any>;
    status: string;
  }): Promise<string> {
    const response = await this.api.post('/connections/create', params);
    return response.data.connectionId as string;
  }

  async completeFarosWorkspaceSetup(workspaceId: string): Promise<string> {
    return await this.completeWorkspaceSetup({
      workspaceId,
      initialSetupComplete: true,
      anonymousDataCollection: false,
      news: false,
      securityUpdates: false,
    });
  }

  async createFarosDestinationDefinition(
    workspaceId: string,
    version: string
  ): Promise<string> {
    return await this.createCustomDestinationDefinition({
      workspaceId,
      destinationDefinition: {
        name: 'Faros Destination',
        dockerRepository: 'farosai/airbyte-faros-destination',
        dockerImageTag: version,
        documentationUrl: 'https://docs.faros.ai',
      },
    });
  }

  async createFarosDestination(
    workspaceId: string,
    farosDestinationDefinitionId: string,
    hasura_url: string,
    hasura_admin_secret: string,
    segment_user_id: string
  ): Promise<string> {
    return await this.createDestination({
      workspaceId,
      destinationDefinitionId: farosDestinationDefinitionId,
      name: 'Faros Destination',
      connectionConfiguration: {
        dry_run: false,
        jsonata_mode: 'FALLBACK',
        edition_configs: {
          edition: 'community',
          hasura_url,
          hasura_admin_secret,
          segment_user_id,
        },
        invalid_record_strategy: 'SKIP',
      },
    });
  }

  async getFarosDestinationId(workspaceId: string): Promise<string> {
    return (await this.listDestinationNames({workspaceId})).filter(
      (name: string) => name === 'Faros Destination'
    )[0];
  }

  async createSourceFromYAML(
    workspaceId: string,
    yamlData: any,
    sourceName: string,
    sourceDefinitionId: string
  ): Promise<string> {
    const source = findEntryWithAttributeValue(yamlData, 'name', sourceName);

    return await this.createSource({
      workspaceId,
      sourceDefinitionId,
      name: source.name,
      connectionConfiguration: source.configuration,
    });
  }

  async createConnectionToFaros(
    sourceId: string,
    farosDestinationId: string,
    yamlData: any,
    connectionName: string
  ): Promise<string> {
    const connection = findEntryWithAttributeValue(
      yamlData,
      'name',
      connectionName
    );
    const streams: any[] = connection.catalog.streams;
    const streamsWithConfig = streams.map((stream) => {
      const streamWithConfig = {...stream};
      streamWithConfig.config = {
        syncMode: stream.syncMode,
        cursorField: stream.cursorField,
        destinationSyncMode: stream.destinationSyncMode,
        primaryKey: stream.primaryKey,
        selected: true,
      };

      delete streamWithConfig.syncMode;
      delete streamWithConfig.cursorField;
      delete streamWithConfig.destinationSyncMode;
      delete streamWithConfig.primaryKey;
      // removing it completely causes the sync to not start
      streamWithConfig.stream.jsonSchema = {};
      return streamWithConfig;
    });

    return await this.createConnection({
      name: connection.name,
      sourceId,
      destinationId: farosDestinationId,
      syncCatalog: {
        streams: streamsWithConfig,
      },
      prefix: connection.prefix,
      status: connection.status,
    });
  }

  async handleFarosSource(
    name: string,
    workspaceId: string,
    farosDestinationId: string,
    farosConnectorsVersion: string,
    yamlSourceData: any,
    yamlCatalogData: any
  ): Promise<void> {
    const sourceDefinitionId = await this.createCustomSourceDefinition({
      workspaceId,
      sourceDefinition: {
        name,
        dockerRepository: 'farosai/airbyte-' + name.toLowerCase() + '-source',
        dockerImageTag: farosConnectorsVersion,
        documentationUrl: 'https://docs.faros.ai',
      },
    });
    logger.info('sourceDefinitionId for ' + name + ': ' + sourceDefinitionId);

    await this.createAndConnectSource(
      name,
      workspaceId,
      farosDestinationId,
      yamlSourceData,
      yamlCatalogData,
      sourceDefinitionId
    );
  }

  async createAndConnectSource(
    name: string,
    workspaceId: string,
    farosDestinationId: string,
    yamlSourceData: any,
    yamlCatalogData: any,
    sourceDefinitionId: string
  ): Promise<void> {
    const sourceId = await this.createSourceFromYAML(
      workspaceId,
      yamlSourceData,
      name,
      sourceDefinitionId
    );
    logger.info('sourceId for ' + name + ': ' + sourceId);

    const connectionId = await this.createConnectionToFaros(
      sourceId,
      farosDestinationId,
      yamlCatalogData,
      name + ' - Faros'
    );
    logger.info('connectionId for ' + name + ': ' + connectionId);
  }

  async init(
    farosConnectorsVersion: string,
    hasuraUrl: string,
    hasuraAdminSecret: string,
    segmentUserId: string
  ): Promise<void> {
    logger.info('init');

    const workspaceId = await this.getFirstWorkspace();
    logger.info('workspaceId: ' + workspaceId);
    await this.completeFarosWorkspaceSetup(workspaceId);

    const farosDestinationDefintionId =
      await this.createFarosDestinationDefinition(
        workspaceId,
        farosConnectorsVersion
      );
    logger.info('farosDestinationDefintionId: ' + farosDestinationDefintionId);

    const farosDestinationId = await this.createFarosDestination(
      workspaceId,
      farosDestinationDefintionId,
      hasuraUrl,
      hasuraAdminSecret,
      segmentUserId
    );
    logger.info('farosDestinationId: ' + farosDestinationId);

    // do NOT converstion to camel case
    const yamlSourceData = loadYamlFile(SOURCES);

    // convert to camel case because of sync_mode (file) vs syncMode (API)
    const yamlCatalogData = convertKeysToCamelCase(loadYamlFile(CATALOGS));

    const communitySources = [
      ['GitHub', 'ef69ef6e-aa7f-4af1-a01d-ef775033524e'],
      ['GitLab', '5e6175e5-68e1-4c17-bff9-56103bbb0d80'],
      ['Jira', '68e63de2-bb83-4c7e-93fa-a8a9051e3993'],
    ];
    for (const communitySource of communitySources) {
      logger.info(
        'sourceDefinitionId for ' +
          communitySource[0] +
          ': ' +
          communitySource[1] +
          ' (community)'
      );
      await this.createAndConnectSource(
        communitySource[0],
        workspaceId,
        farosDestinationId,
        yamlSourceData,
        yamlCatalogData,
        communitySource[1]
      );
    }

    const farosSources = [
      'Bitbucket',
      'Phabricator',
      'Buildkite',
      'CircleCI',
      'Harness',
      'Jenkins',
      'Datadog',
      'OpsGenie',
      'PagerDuty',
      'SquadCast',
      'Statuspage',
      'VictorOps',
    ];
    for (const farosSource of farosSources) {
      await this.handleFarosSource(
        farosSource,
        workspaceId,
        farosDestinationId,
        farosConnectorsVersion,
        yamlSourceData,
        yamlCatalogData
      );
    }
  }
}
