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

  async createSource(params: {
    sourceDefinitionId: string;
    connectionConfiguration: Dictionary<any>;
    workspaceId: string;
    name: string;
  }): Promise<string> {
    const response = await this.api.post('/sources/create', params);
    return response.data.sourceId as string;
  }
}
