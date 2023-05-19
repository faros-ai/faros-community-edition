import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import pino from 'pino';
import {VError} from 'verror';

export interface ConnectionConfiguration {
  dry_run: boolean;
  jsonata_mode: string;
  edition_configs: EditionConfigs;
  invalidRecordStrategy: string;
}

export interface EditionConfigs {
  edition: string;
  hasura_url: string;
  segment_user_id: string;
  hasura_admin_secret: string;
}

const logger = pino({
  name: 'airbyte-client',
  level: process.env.LOG_LEVEL || 'info',
});

export class AirbyteClient {
  private readonly api: AxiosInstance;

  constructor(url: string) {
    this.api = axios.create({
      baseURL: `${url}/api/v1`,
    });
  }

  async waitUntilHealthy(): Promise<void> {
    await retry(
      async () => {
        const response = await this.api.get('/health');
        if (!(response.data.available ?? false)) {
          throw new VError('Airbyte is not healthy yet');
        }
      },
      {
        retries: 3,
        minTimeout: 10000,
        maxTimeout: 10000,
        onRetry: (err, attempt) => {
          logger.info('attempt=%d err=%o', attempt, err);
        },
      }
    );
  }

  async getFirstWorkspace(): Promise<string> {
    const response = await this.api.post('/workspaces/list', {});
    return response.data.workspaces[0].workspaceId as string;
  }

  async checkDestinationConnection(destinationName: string): Promise<boolean> {
    const workspaceId = await this.getFirstWorkspace();
    const response = await this.api.post('/destinations/list', {workspaceId});
    return (
      response.data.destinations.filter(
        (destination) => destination.name === destinationName
      ).length > 0
    );
  }

  async getDestinationConnectionConfiguration(
    destinationName: string
  ): Promise<ConnectionConfiguration> {
    const workspaceId = await this.getFirstWorkspace();
    const response = await this.api.post('/destinations/list', {workspaceId});
    return response.data.destinations.filter(
      (destination) => destination.name === destinationName
    )[0].connectionConfiguration as ConnectionConfiguration;
  }
}
