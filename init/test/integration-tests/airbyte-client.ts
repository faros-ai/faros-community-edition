import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
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
        retries: 30,
        minTimeout: 1000,
        maxTimeout: 1000,
      }
    );
  }

  async checkDestinationConnection(destinationId: string): Promise<boolean> {
    return await this.api
      .post('/destinations/check_connection', {
        destinationId,
      })
      .then((response) => response.data.status === 'succeeded');
  }

  async getDestinationConnectionConfiguration(
    destinationId: string
  ): Promise<ConnectionConfiguration> {
    return await this.api
      .post('/destinations/get', {
        destinationId,
      })
      .then(
        (response) =>
          response.data.connectionConfiguration as ConnectionConfiguration
      );
  }
}
