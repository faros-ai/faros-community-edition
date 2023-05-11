import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {Dictionary} from 'lodash';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

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

  constructor(
    airbyteUrl: string,
    axiosConfig: Omit<AxiosRequestConfig, 'baseUrl'> = {
      headers: {
        'Authorization': "Basic YWlyYnl0ZTpwYXNzd29yZA=="
      }
    }
  ) {
    this.api = axios.create({baseURL: `${airbyteUrl}/api/v1`, ...axiosConfig});
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


  async getFarosWorkspace(): Promise<string> {
    return this.getWorkspaceBySlug({
      slug: "faros"
    })
  }

  async createFarosWorkspace(): Promise<string> {
    return this.createWorkspace({
      name: "faros"
    })
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

  async createFarosDestinationDefinition(workspaceId: string): Promise<string> {
    return this.createCustomDestinationDefinition({
      workspaceId,
      destinationDefinition: {
        name: "Faros Destination",
        dockerRepository: "farosai/airbyte-faros-destination",
        dockerImageTag: "0.4.69",
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

  // TODO: cleanup
  async getFarosDestinationId(workspaceId: string):  Promise<string> {
    return (await this.listDestinationNames({workspaceId})).filter((name: string) => name === "Faros Destination")[0]
  }

  async createGitHubSource(workspaceId: string, yamlData: any, sourceDefinitionId: string): Promise<string> {
    const source = findEntryWithAttributeValue(yamlData, "sourceDefinitionId", sourceDefinitionId);

    return this.createSource({
      workspaceId,
      sourceDefinitionId: sourceDefinitionId,
      name: source.name,
      connectionConfiguration: source.configuration
    })
  }

  
  async createConnectionToFaros(sourceId: string, farosDestinationId: string, yamlData: any, source: string): Promise<string> {
    
    const connection = findEntryWithAttributeValue(yamlData, "prefix", source);
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
      delete streamWithConfig.stream.jsonSchema;
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

  async init() {
    const workspaceId = await this.getFirstWorkspace();
    console.log(workspaceId);
    await this.completeFarosWorkspaceSetup(workspaceId);

    const farosDestinationDefintionId = await this.createFarosDestinationDefinition(workspaceId);
    console.log(farosDestinationDefintionId);

    const farosDestinationId = await this.createFarosDestination(workspaceId, farosDestinationDefintionId, "http://localhost:8080", "admin", "123e4567-e89b-12d3-a456-426614174000");
    console.log(farosDestinationId);

    const yamlSourceFilePath = 'resources/airbyte/workspace/airbyte_config/SOURCE_CONNECTION.yaml';
    const yamlSourceData = loadYamlFile(yamlSourceFilePath);
    const ghSourceDefinitionId = "ef69ef6e-aa7f-4af1-a01d-ef775033524e";
    const ghSourceId = await this.createGitHubSource(workspaceId, yamlSourceData, ghSourceDefinitionId);
    console.log(ghSourceId);

    const yamlConnectionFilePath = 'resources/airbyte/workspace/airbyte_config/STANDARD_SYNC.yaml';
    const yamlConnectionData = convertKeysToCamelCase(loadYamlFile(yamlConnectionFilePath));
    const ghConnectionId = await this.createConnectionToFaros(ghSourceId, farosDestinationId, yamlConnectionData, "github_source__github__");
    console.log(ghConnectionId);
  }
}

let airbyteInitV40: AirbyteInitV40 = new AirbyteInitV40("http://localhost:8000");
airbyteInitV40.init();
