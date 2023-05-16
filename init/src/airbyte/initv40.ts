import {AxiosInstance} from 'axios';
import {Dictionary} from 'lodash';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import pino from 'pino';
import path from 'path';

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
function findEntryWithAttributeValue(data: any[], attribute: string, value: any): any {
  return data.find(entry => entry[attribute] === value);
}

function snakeCaseToCamelCase(snakeCaseStr: string): string {
  return snakeCaseStr.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

function convertKeysToCamelCase(data: any): any {
  if (Array.isArray(data)) {
    return data.map(convertKeysToCamelCase);
  } else if (data !== null && typeof data === 'object') {
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      const camelCaseKey = snakeCaseToCamelCase(key);
      newData[camelCaseKey] = convertKeysToCamelCase(data[key]);
    }
    return newData;
  } else {
    return data;
  }
}

export class AirbyteInitV40 {
  private readonly api: AxiosInstance;

  constructor(api: AxiosInstance) {
    this.api = api;
  }

  async createWorkspace(params: {
    name: string;
  }): Promise<string> {
    const response = await this.api.post('/workspaces/create', params);
    return response.data.workspaceId as string;
  }
  
  async getWorkspaceBySlug(params: {
    slug: string
  }): Promise<string> {
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
    const response = await this.api.post('/source_definitions/create_custom', params);
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
    const response = await this.api.post('/destination_definitions/create_custom', params);
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

  async listDestinationNames(params: {
    workspaceId: string;
  }): Promise<string[]> {
    const response = await this.api.post('/destinations/list', params);
    return response.data.destinations.map((destination: any) => destination.name) as string[];
  }

  async getCatalog(params: {
    sourceId: string;
  }): Promise<Dictionary<any>> {
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
    return this.completeWorkspaceSetup({
      workspaceId,
      initialSetupComplete: true,
      anonymousDataCollection: false,
      news: false,
      securityUpdates: false
    })
  }

  async createFarosDestinationDefinition(workspaceId: string, version: string): Promise<string> {
    return this.createCustomDestinationDefinition({
      workspaceId,
      destinationDefinition: {
        name: "Faros Destination",
        dockerRepository: "farosai/airbyte-faros-destination",
        dockerImageTag: version,
        documentationUrl: "https://docs.faros.ai"
      }
    })
  }

  async createFarosDestination(workspaceId: string, farosDestinationDefinitionId: string, hasura_url: string, hasura_admin_secret: string, segment_user_id: string): Promise<string> {
    return this.createDestination({
      workspaceId,
      destinationDefinitionId: farosDestinationDefinitionId,
      name: "Faros Destination",
      connectionConfiguration: {
        dry_run: false,
        jsonata_mode: "FALLBACK",
        edition_configs: {
          edition: "community",
          hasura_url,
          hasura_admin_secret,
          segment_user_id,
        },
      invalid_record_strategy: "SKIP"
      }
    })
  }

  async getFarosDestinationId(workspaceId: string):  Promise<string> {
    return (await this.listDestinationNames({workspaceId})).filter((name: string) => name === "Faros Destination")[0]
  }

  async createSourceFromYAML(workspaceId: string, yamlData: any, sourceName: string, sourceDefinitionId : string): Promise<string> {
    const source = findEntryWithAttributeValue(yamlData, "name", sourceName);

    return this.createSource({
      workspaceId,
      sourceDefinitionId: sourceDefinitionId,
      name: source.name,
      connectionConfiguration: source.configuration
    })
  }

  async createConnectionToFaros(sourceId: string, farosDestinationId: string, yamlData: any, connectionName: string): Promise<string> {
    
    const connection = findEntryWithAttributeValue(yamlData, "name", connectionName);
    const streams: any[] = connection.catalog.streams;
    const streamsWithConfig = streams.map(stream => {
      var streamWithConfig = { ...stream };
      streamWithConfig.config = {
        syncMode: stream.syncMode,
        cursorField: stream.cursorField,
        destinationSyncMode:stream.destinationSyncMode,
        primaryKey: stream.primaryKey,
        selected: true
      };

      delete streamWithConfig.syncMode;
      delete streamWithConfig.cursorField;
      delete streamWithConfig.destinationSyncMode;
      delete streamWithConfig.primaryKey;
      streamWithConfig.stream.jsonSchema = {}; // removing it completely causes the sync to not start
      return streamWithConfig;
    })

    return this.createConnection({
      name: connection.name,
      sourceId, 
      destinationId: farosDestinationId,
      syncCatalog: {
        streams: streamsWithConfig
      },
      prefix: connection.prefix,
      status: connection.status
    })
  }

  async init(farosConnectorsVersion: string) {
    logger.info('init');

    const workspaceId = await this.getFirstWorkspace();
    console.log("workspaceId: " + workspaceId);
    await this.completeFarosWorkspaceSetup(workspaceId);

    const farosDestinationDefintionId = await this.createFarosDestinationDefinition(workspaceId, farosConnectorsVersion);
    console.log("farosDestinationDefintionId: " + farosDestinationDefintionId);

    const farosDestinationId = await this.createFarosDestination(workspaceId, farosDestinationDefintionId, "http://localhost:8080", "admin", "123e4567-e89b-12d3-a456-426614174000");
    console.log("farosDestinationId: " + farosDestinationId);

    const yamlSourceData = loadYamlFile(SOURCES); // do NOT converstion to camel case 
    
    // convert to camel case because of sync_mode (file) vs syncMode (API)
    const yamlCatalogData = convertKeysToCamelCase(loadYamlFile(CATALOGS)); 

    const githubSourceDefinitionId = "ef69ef6e-aa7f-4af1-a01d-ef775033524e";
    const githubSourceId = await this.createSourceFromYAML(workspaceId, yamlSourceData, "GitHub", githubSourceDefinitionId);
    console.log("githubSourceId: " + githubSourceId);
    const githubConnectionId = await this.createConnectionToFaros(githubSourceId, farosDestinationId, yamlCatalogData, "GitHub - Faros");
    console.log("githubConnectionId: " + githubConnectionId);

    const gitlabSourceDefinitionId = "5e6175e5-68e1-4c17-bff9-56103bbb0d80";
    const gitlabSourceId = await this.createSourceFromYAML(workspaceId, yamlSourceData, "GitLab", gitlabSourceDefinitionId);
    console.log("gitlabSourceId: " + gitlabSourceId);
    const gitlabConnectionId = await this.createConnectionToFaros(gitlabSourceId, farosDestinationId, yamlCatalogData, "GitLab - Faros");
    console.log("gitlabConnectionId: " + gitlabConnectionId);


    const bitbucketSourceDefinitionId = await this.createCustomSourceDefinition({
      workspaceId,
      sourceDefinition: {
        name: "Bitbucket",
        dockerRepository: "farosai/airbyte-bitbucket-source",
        dockerImageTag: farosConnectorsVersion ? farosConnectorsVersion : "0.4.69",
        documentationUrl: "https://docs.faros.ai"
      }
    })
    console.log("bitbucketSourceDefinitionId: " + bitbucketSourceDefinitionId);

    const bitbucketSourceId = await this.createSourceFromYAML(workspaceId, yamlSourceData, "Bitbucket", bitbucketSourceDefinitionId);
    console.log("bitbucketSourceId: " + bitbucketSourceId);

    const bitbucketConnectionId = await this.createConnectionToFaros(bitbucketSourceId, farosDestinationId, yamlCatalogData, "Bitbucket - Faros");
    console.log("bitbucketConnectionId: " + bitbucketConnectionId);

    const jiraSourceDefinitionId = "68e63de2-bb83-4c7e-93fa-a8a9051e3993";
    const jiraSourceId = await this.createSourceFromYAML(workspaceId, yamlSourceData, "Jira", jiraSourceDefinitionId);
    console.log("jiraSourceId: " + jiraSourceId);

    const jiraConnectionId = await this.createConnectionToFaros(jiraSourceId, farosDestinationId, yamlCatalogData, "Jira - Faros");
    console.log("jiraConnectionId: " + jiraConnectionId);

  }
}
