import {Analytics} from '@segment/analytics-node';
import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import {InvalidArgumentError, program} from 'commander';
import {find} from 'lodash';
import pino from 'pino';
import {v5 as uuidv5} from 'uuid';
import {VError} from 'verror';

import {AirbyteInitV40} from './initv40';

const logger = pino({
  name: 'airbyte-init',
  level: process.env.LOG_LEVEL || 'info',
});

export const FAROS_DEST_REPO = 'farosai/airbyte-faros-destination';

const UUID_NAMESPACE = 'bb229e18-eb5f-4309-a863-893cbec53758';

interface SegmentUser {
  readonly userId: string;
  readonly email: string;
  readonly version: string;
  readonly source: string;
}

export class AirbyteInit {
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

  static makeSegmentUser(): SegmentUser | undefined {
    const version = process.env.FAROS_INIT_VERSION || '';
    const source = process.env.FAROS_START_SOURCE || '';
    const envEmail = process.env.FAROS_EMAIL;
    if (envEmail && envEmail !== undefined && envEmail !== '') {
      return {
        userId: uuidv5(envEmail, UUID_NAMESPACE),
        email: envEmail,
        version,
        source,
      };
    }
    return undefined;
  }

  static async sendIdentityAndStartEvent(
    segmentUser: SegmentUser | undefined,
    host?: string | undefined
  ): Promise<void> {
    if (segmentUser === undefined) {
      logger.info('Skipping Telemetry');
      return Promise.resolve();
    }
    const analytics = new Analytics({
      writeKey: 'YFJm3AJBKwOm0Hp4o4vD9iqnZN5bVn45',
      // Segment host is used for testing purposes only
      host,
    });
    try {
      analytics.identify({
        userId: segmentUser?.userId,
        traits: {
          email: segmentUser?.email,
          version: segmentUser?.version,
          source: segmentUser?.source,
        },
      });
      analytics.track({userId: segmentUser?.userId, event: 'Start'});
      await analytics.closeAndFlush();
    } catch (err) {
      if (err instanceof Error) {
        logger.error(`Failed to send identity and start event: ${err.message}`);
      }
    }
  }

  async setupWorkspace(
    segmentUser: SegmentUser | undefined,
    hasuraAdminSecret: string,
    airbyteDestinationHasuraUrl: string,
    forceSetup?: boolean
  ): Promise<void> {
    const response = await this.api.post('/workspaces/list');
    const workspaces: any[] = response.data.workspaces ?? [];
    if (workspaces.length === 0) {
      throw new VError('Default workspace not found');
    } else if (workspaces.length > 1) {
      throw new VError('Cannot support more than one workspace');
    }
    const workspace = workspaces[0];
    const workspaceId = workspace.workspaceId;

    if (workspace.initialSetupComplete) {
      logger.info(`Workspace ${workspaceId} is already set up`);
      // TODO: force setup
      if (forceSetup) {
        throw new VError('Forced setup not supported');
      }
      return; // TODO: connector upgrades
    }
    logger.info(`Setting up workspace ${workspaceId}`);

    // TODO: connectors upgrades
    const farosConnectorsVersion = await AirbyteInit.getLatestImageTag(
      FAROS_DEST_REPO
    );
    logger.info('faros connectors version: ' + farosConnectorsVersion);
    const airbyteInitV40: AirbyteInitV40 = new AirbyteInitV40(this.api);
    try {
      // destination spec expects uuid for segment_user_id
      // empty string fails validation
      await airbyteInitV40.init(
        farosConnectorsVersion,
        airbyteDestinationHasuraUrl,
        hasuraAdminSecret,
        segmentUser?.userId ?? '00000000-0000-0000-0000-000000000000'
      );
    } catch (error) {
      throw new VError(`Failed to set up workspace: ${error}`);
    }
  }

  static async getLatestImageTag(
    repository: string,
    page = 1,
    pageSize = 10
  ): Promise<string> {
    const response = await axios.get(
      `https://hub.docker.com/v2/repositories/${repository}/tags`,
      {params: {page, page_size: pageSize, ordering: 'last_updated'}}
    );
    const tags: {name: string}[] = response.data.results;
    const version = find(
      tags,
      (t) => t.name !== 'latest' && !t.name.endsWith('-rc')
    )?.name;
    if (!version) {
      if (response.data.next) {
        return await AirbyteInit.getLatestImageTag(
          repository,
          page + 1,
          pageSize
        );
      }
      throw new VError(
        'Unable to determine latest image version of %s',
        repository
      );
    }
    return version;
  }
}

async function main(): Promise<void> {
  program
    .requiredOption('--airbyte-url <string>')
    .requiredOption('--airbyte-destination-hasura-url <string>')
    .requiredOption('--hasura-admin-secret <string>')
    .option('--force-setup')
    .option(
      '--airbyte-api-calls-concurrency <num>',
      'the max number of concurrent Airbyte api calls',
      parseInt
    );
  program.parse();
  const options = program.opts();

  if (options?.airbyteApiCallsConcurrency <= 0) {
    throw new InvalidArgumentError(
      'airbyte-api-calls-concurrency must be a positive integer'
    );
  }

  const airbyte = new AirbyteInit(
    axios.create({
      baseURL: `${options.airbyteUrl}/api/v1`,
    })
  );

  const segmentUser = AirbyteInit.makeSegmentUser();

  await AirbyteInit.sendIdentityAndStartEvent(segmentUser);

  await airbyte.waitUntilHealthy();

  await airbyte.setupWorkspace(
    segmentUser,
    options.hasuraAdminSecret,
    options.airbyteDestinationHasuraUrl,
    options.forceSetup
  );

  logger.info('Airbyte setup is complete');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
