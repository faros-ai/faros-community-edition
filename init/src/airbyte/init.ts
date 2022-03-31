import Analytics from 'analytics-node';
import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import {InvalidArgumentError, program} from 'commander';
import fs from 'fs-extra';
import handlebars from 'handlebars';
import {find} from 'lodash';
import os from 'os';
import pLimit from 'p-limit';
import path from 'path';
import pino from 'pino';
import tar from 'tar';
import util from 'util';
import {v4 as uuidv4, v5 as uuidv5} from 'uuid';
import {VError} from 'verror';

import {BASE_RESOURCES_DIR} from '../config';
import {DestinationDefinition, SourceDefinition} from './types';

const logger = pino({
  name: 'airbyte-init',
  level: process.env.LOG_LEVEL || 'info',
});

export const FAROS_DEST_REPO = 'farosai/airbyte-faros-destination';
const WORKSPACE_TEMPLATE_DIR = path.join(
  BASE_RESOURCES_DIR,
  'airbyte',
  'workspace'
);

const UUID_NAMESPACE = 'bb229e18-eb5f-4309-a863-893cbec53758';

interface SegmentUser {
  readonly userId: string;
  readonly email: string;
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

  private static getDestinationTemplatePath(dir: string): string {
    return path.join(dir, 'airbyte_config', 'DESTINATION_CONNECTION.yaml');
  }

  static makeSegmentUser(): SegmentUser {
    const envEmail = process.env.FAROS_EMAIL;
    if (envEmail && envEmail !== undefined && envEmail !== '') {
      return {
        userId: uuidv5(envEmail, UUID_NAMESPACE),
        email: envEmail,
      };
    }
    const email = 'anonymous@anonymous.me';
    if (process.env.HOSTNAME) {
      return {userId: uuidv5(process.env.HOSTNAME, UUID_NAMESPACE), email};
    }
    return {userId: uuidv4(), email};
  }

  static sendIdentityAndStartEvent(
    segmentUser: SegmentUser,
    host?: string | undefined
  ): Promise<void> {
    const analytics = new Analytics('YEu7VC65n9dIR85pQ1tgV2RHQHjo2bwn', {
      // Segment host is used for testing purposes only
      host,
    });
    const fn = (callback: ((err: Error) => void) | undefined): void => {
      analytics
        .identify(
          {
            userId: segmentUser.userId,
            traits: {email: segmentUser.email},
          },
          callback
        )
        .track(
          {
            userId: segmentUser.userId,
            event: 'Start',
          },
          callback
        )
        .flush(callback);
    };

    return util
      .promisify(fn)()
      .catch((err) =>
        logger.error(`Failed to send identity and start event: ${err.message}`)
      );
  }

  async setupWorkspace(
    segmentUser: SegmentUser,
    hasuraAdminSecret: string,
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
      if (forceSetup) {
        logger.info(`Re-setting up workspace ${workspaceId}`);
      } else {
        return;
      }
    } else {
      logger.info(`Setting up workspace ${workspaceId}`);
    }

    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'faros-ce-airbyte-init')
    );
    await fs.copy(WORKSPACE_TEMPLATE_DIR, tmpDir, {recursive: true});
    const destTemplatePath = AirbyteInit.getDestinationTemplatePath(tmpDir);
    const destTemplate = await fs.readFile(destTemplatePath, 'utf-8');
    await fs.writeFile(
      destTemplatePath,
      handlebars.compile(destTemplate)({
        hasura_admin_secret: hasuraAdminSecret,
        segment_user_id: segmentUser.userId,
      }),
      'utf-8'
    );
    const workspaceZipPath = path.join(tmpDir, 'workspace.tar.gz');
    try {
      await tar.create(
        {
          cwd: tmpDir,
          file: workspaceZipPath,
          gzip: true,
        },
        ['VERSION', 'airbyte_config']
      );
      const buffer = await fs.readFile(workspaceZipPath);
      await this.api.post('/deployment/import', buffer, {
        headers: {'Content-Type': 'application/x-gzip'},
      });
    } catch (error) {
      throw new VError(`Failed to set up workspace: ${error}`);
    } finally {
      await fs.remove(tmpDir);
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
        'Unable to determine latest image version of Faros Destination'
      );
    }
    return version;
  }

  async setupFarosDestinationDefinition(): Promise<void> {
    const version = await AirbyteInit.getLatestImageTag(FAROS_DEST_REPO);
    const listResponse = await this.api.post('/destination_definitions/list');
    const farosDestDef = find(
      listResponse.data.destinationDefinitions as DestinationDefinition[],
      (dd) => dd.dockerRepository === FAROS_DEST_REPO
    );

    if (!farosDestDef) {
      logger.info(`Adding Faros Destination ${version}`);
      await this.api.post('/destination_definitions/create', {
        name: 'Faros Destination',
        dockerRepository: FAROS_DEST_REPO,
        dockerImageTag: version,
        documentationUrl: 'https://docs.faros.ai',
      });
    } else if (farosDestDef.dockerImageTag === version) {
      logger.info('Faros Destination is already at %s', version);
    } else {
      logger.info(
        'Updating Faros Destination from %s to %s',
        farosDestDef.dockerImageTag,
        version
      );
      await this.api.post('/destination_definitions/update', {
        destinationDefinitionId: farosDestDef.destinationDefinitionId,
        dockerImageTag: version,
      });
    }
  }

  async updateFarosSourceVersions(concurrency?: number): Promise<void> {
    const listResponse = await this.api.post('/source_definitions/list');
    const farosSourceDefs = (
      listResponse.data.sourceDefinitions as SourceDefinition[]
    ).filter((sd) => sd.dockerRepository.startsWith('farosai/'));

    const promises: Promise<void>[] = [];
    const limit = pLimit(concurrency || Number.POSITIVE_INFINITY);

    for (const sourceDef of farosSourceDefs) {
      const version = await AirbyteInit.getLatestImageTag(
        sourceDef.dockerRepository
      );
      if (sourceDef.dockerImageTag !== version) {
        logger.info(
          'Updating Faros %s source from %s to %s',
          sourceDef.name,
          sourceDef.dockerImageTag,
          version
        );
        promises.push(
          limit(() =>
            this.api.post('/source_definitions/update', {
              sourceDefinitionId: sourceDef.sourceDefinitionId,
              dockerImageTag: version,
            })
          )
        );
      }
    }
    await Promise.all(promises);
  }
}

async function main(): Promise<void> {
  program
    .requiredOption('--airbyte-url <string>')
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
    options.forceSetup
  );
  await airbyte.setupFarosDestinationDefinition();
  await airbyte.updateFarosSourceVersions(options.airbyteApiCallsConcurrency);
  logger.info('Airbyte setup is complete');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
