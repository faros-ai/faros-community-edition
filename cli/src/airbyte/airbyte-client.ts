import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import {VError} from 'verror';

export class Airbyte {
  constructor(private readonly api: AxiosInstance) {}

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

  async setupSource(config: any): Promise<void> {
    await this.api
      .post('/sources/check_connection_for_update', config)
      .catch((err) => {
        throw new VError(err);
      });

    await this.api.post('/sources/update', config).catch((err) => {
      throw new VError(err);
    });
  }

  async triggerSync(connectionId: string): Promise<number> {
    const response = await this.api
      .post('/connections/sync', {
        connectionId,
      })
      .catch((err) => {
        throw new VError(err);
      });
    return response.data.job.id;
  }

  async getJobStatus(job: number): Promise<string> {
    const response = await this.api
      .post('/jobs/get', {
        id: job,
      })
      .catch((err) => {
        throw new VError(err);
      });
    return response.data.job.status;
  }
}
