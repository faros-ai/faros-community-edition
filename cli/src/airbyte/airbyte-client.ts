import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import ProgressBar from 'progress';
import {VError} from 'verror';

import {display, Emoji, errorLog, sleep, terminalLink} from '../utils';

export class Airbyte {
  private readonly api: AxiosInstance;
  private readonly airbyteUrl: string;

  constructor(airbyteUrl: string) {
    this.airbyteUrl = airbyteUrl.replace(/\/+$/, '');
    this.api = axios.create({
      baseURL: `${this.airbyteUrl}/api/v1`,
    });
  }

  async waitUntilHealthy(): Promise<void> {
    display('Checking connection with Airbyte %s', Emoji.CHECK_CONNECTION);

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
    display('Setting up source %s', Emoji.SETUP);
    await this.api
      .post('/sources/check_connection_for_update', config)
      .catch((err) => {
        throw new VError(err);
      });

    await this.api.post('/sources/update', config).catch((err) => {
      throw new VError(err);
    });

    display('Setup succeeded %s', Emoji.SUCCESS);
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
      display('Syncing %s', Emoji.SYNC);
      const job = await this.triggerSync(connectionId);

      const syncBar = new ProgressBar(':bar', {
        total: 2,
        complete: process.env.FAROS_NO_EMOJI ? '.' : Emoji.PROGRESS,
        incomplete: ' ',
      });

      let val = 1;
      let running = true;
      while (running) {
        syncBar.tick(val);
        val *= -1;
        const status = await this.getJobStatus(job);
        if (status !== 'running') {
          running = false;
          syncBar.terminate();
          if (status !== 'succeeded') {
            errorLog(
              `Sync ${status}. %s Please check the ${await terminalLink(
                'logs',
                this.airbyteStatusUrl(connectionId)
              )}`,
              Emoji.FAILURE
            );
          } else {
            display('Syncing succeeded %s', Emoji.SUCCESS);
          }
        }
        await sleep(1000);
      }
    } catch (error) {
      errorLog(
        `Sync failed. %s Please check the ${await terminalLink(
          'logs',
          this.airbyteStatusUrl(connectionId)
        )}`,
        Emoji.FAILURE,
        error
      );
    }
  }

  private airbyteStatusUrl(connectionId: string): string {
    return `${this.airbyteUrl}/connections/${connectionId}/status`;
  }
}
