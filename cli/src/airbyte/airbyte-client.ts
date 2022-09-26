import retry from 'async-retry';
import {AxiosInstance} from 'axios';
import ProgressBar from 'progress';
import {VError} from 'verror';

import {display, errorLog, sleep} from '../utils';

export class Airbyte {
  constructor(private readonly api: AxiosInstance) {}

  async waitUntilHealthy(): Promise<void> {
    display('Checking connection with Airbyte');

    await retry(
      async () => {
        await this.api
          .get('/health')
          .then((response) => {
            if (!(response.data.available ?? false)) {
              throw new VError('Airbyte is not healthy yet');
            }
          })
          .catch((err) => {
            throw new VError(err, 'Could not connect to Airbyte');
          });
      },
      {
        retries: 5,
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

  async triggerAndTrackSync(connectionId: string): Promise<void> {
    try {
      display('Syncing');
      const job = await this.triggerSync(connectionId);

      const syncBar = new ProgressBar(':bar', {
        total: 2,
        complete: '.',
        incomplete: ' ',
      });

      let val = 1;
      while (true) {
        syncBar.tick(val);
        val *= -1;
        const status = await this.getJobStatus(job);
        if (status !== 'running') {
          syncBar.terminate();
          display('Syncing ' + status);
          break;
        }
        await sleep(100);
      }
    } catch (error) {
      errorLog('Sync failed', error);
      return;
    }
  }
}
