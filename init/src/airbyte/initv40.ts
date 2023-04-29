import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {Dictionary} from 'lodash';

export class AirbyteInitV40 {
  private readonly api: AxiosInstance;

  constructor(
    airbyteUrl: string,
    axiosConfig: Omit<AxiosRequestConfig, 'baseUrl'> = {}
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

  async createFarosWorkspace(): Promise<string> {
    return this.createWorkspace({
      name: "faros"
    })
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
    sourceDefinition: {
      name: string;
      dockerRepository: string;
      dockerImageTag: string;
      documentationUrl: string;
    };
  }): Promise<string> {
    const response = await this.api.post('/destination_definitions/create_custom', params);
    return response.data.sourceDefinitionId as string;
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
    return response.data.sourceId as string;
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
  }): Promise<string> {
    const response = await this.api.post('/connections/create', params);
    return response.data.connectionId as string;
  }


  async getFarosWorkspace(): Promise<string> {
    return this.getWorkspaceBySlug({
      slug: "faros"
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
      sourceDefinition: {
        name: "Faros Destination",
        dockerRepository: "farosai/airbyte-faros-destination",
        dockerImageTag: "0.4.69",
        documentationUrl: "https://docs.faros.ai"
      }
    })
  }

  async createFarosDestination(workspaceId: string, destinationDefinitionId: string, hasura_url: string, hasura_admin_secret: string, segment_user_id: string): Promise<string> {
    return this.createDestination({
      workspaceId,
      destinationDefinitionId,
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

  // if a stream supports incremental, we use incremental
  // see https://airbyte-public-api-docs.s3.us-east-2.amazonaws.com/rapidoc-api-docs.html#post-/v1/sources/discover_schema
  // and https://airbyte-public-api-docs.s3.us-east-2.amazonaws.com/rapidoc-api-docs.html#post-/v1/connections/create
  async createConnectionToFaros(desired_streams: string[], sourceId: string, farosDestinationId: string, name: string, prefix: string): Promise<string> {
  
    let streams: any[] = (await this.getCatalog({sourceId})).streams;
    streams = streams.filter((entry: any) => desired_streams.includes(entry.stream.name));
    streams = streams.map((entry: any) => {
      const sync_mode = entry.stream.supportedSyncModes.includes("incremental") ? "incremental" : "full_refresh";
      const config = {
        sync_mode,
        destination_sync_mode: "overwrite",
        cursorField: entry.stream.defaultCursorField // we assume all incremental streams have source defined cursors
      }
      entry.config = config;
    })

    return this.createConnection({
      name, 
      sourceId, 
      destinationId: farosDestinationId,
      syncCatalog: streams,
      prefix
    })
  }
}
