import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import { attempt } from 'lodash';
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
        retries: 12,
        minTimeout: 10000,
        maxTimeout: 10000,
        onRetry: (err, attempt) => {
          logger.info('attempt=%d err=%o', attempt, err);
        }
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
