import axios, {AxiosInstance} from 'axios';
import {VError} from 'verror';

export function wrapApiError(cause: unknown, msg: string): Error {
  // Omit verbose axios error
  const truncated = new VError((cause as Error).message);
  return new VError(truncated, msg);
}

export interface MetabaseConfig {
  readonly url: string;
  readonly username: string;
  readonly password: string;
}

export class Metabase {
  constructor(private readonly api: AxiosInstance) {}

  static async fromConfig(cfg: MetabaseConfig): Promise<Metabase> {
    const token = await Metabase.sessionToken(cfg);
    const api = axios.create({
      baseURL: `${cfg.url}/api`,
      headers: {
        'X-Metabase-Session': token,
      },
    });
    return new Metabase(api);
  }

  private static async sessionToken(cfg: MetabaseConfig): Promise<string> {
    const {url, username, password} = cfg;
    try {
      const {data} = await axios.post(`${url}/api/session`, {
        username,
        password,
      });
      return data.id;
    } catch (err) {
      throw wrapApiError(err, 'failed to get session token');
    }
  }

  async forceSync(): Promise<any> {
    try {
      // Objective is to get filter values populated
      // Faros is always has DB id 2
      // note that API call rescan_value was not sufficient
      // hence the call to sync_schema instead
      // https://www.metabase.com/docs/latest/api/database
      const {data} = await this.api.post('database/2/sync_schema');
      return data;
    } catch (err) {
      throw wrapApiError(err, 'unable to trigger rescan');
    }
  }
}
