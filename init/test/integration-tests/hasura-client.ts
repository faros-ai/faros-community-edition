import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import {VError} from 'verror';

export class HasuraClient {
  private readonly api: AxiosInstance;

  constructor(url: string, adminSecret?: string) {
    this.api = axios.create({
      baseURL: url,
      headers: {
        'X-Hasura-Role': 'admin',
        ...(adminSecret && {'X-Hasura-Admin-Secret': adminSecret}),
      },
    });
  }

  async waitUntilHealthy(): Promise<void> {
    await retry(
      async () => {
        try {
          await this.api.get('/healthz');
        } catch (e) {
          throw new VError(e, 'Failed to check Hasura health');
        }
      },
      {
        retries: 12,
        minTimeout: 10000,
        maxTimeout: 10000,
      }
    );
  }

  async getVcsUserCount(): Promise<number> {
    return await this.api
      .post('/v1/graphql', {
        query: 'query MyQuery { vcs_User_aggregate {aggregate{count}} }',
        variables: null,
      })
      .then(
        (response) => response.data.data.vcs_User_aggregate.aggregate.count
      );
  }
}
