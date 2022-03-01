import Analytics from 'analytics-node';
import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import fs from 'fs-extra';
import handlebars from 'handlebars';
import {find} from 'lodash';
import os from 'os';
import path from 'path';
import pino from 'pino';
import tar from 'tar';
import util from 'util';
import {v4 as uuidv4, v5 as uuidv5} from 'uuid';
import {VError} from 'verror';

import {BASE_RESOURCES_DIR} from '../config';

const logger = pino({
  name: 'airbyte-init',
  level: process.env.LOG_LEVEL || 'info',
});

const FAROS_DEST_REPO = 'farosai/airbyte-faros-destination';
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

  static sendIdentity(
    segmentUser: SegmentUser,
    host?: string | undefined
  ): Promise<void> {
    const analytics = new Analytics('YEu7VC65n9dIR85pQ1tgV2RHQHjo2bwn', {
      // Segment host is used for testing purposes only
      host,
    });
    const fn = (callback: ((err: Error) => void) | undefined): Analytics =>
      analytics.identify(
        {userId: segmentUser.userId, traits: {email: segmentUser.email}},
        callback
      );

    return util.promisify(fn)();
  }

  async setupWorkspace(
    segmentUser: SegmentUser,
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
      handlebars.compile(destTemplate)({segment_user_id: segmentUser.userId}),
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

  static async getLatestFarosDestinationVersion(
    page = 1,
    pageSize = 10
  ): Promise<string> {
    const response = await axios.get(
      'https://hub.docker.com/v2/repositories/farosai/airbyte-faros-destination/tags',
      {params: {page, page_size: pageSize, ordering: 'last_updated'}}
    );
    const tags: {name: string}[] = response.data.results;
    const version = find(
      tags,
      (t) => t.name !== 'latest' && !t.name.endsWith('-rc')
    )?.name;
    if (!version) {
      if (response.data.next) {
        return await AirbyteInit.getLatestFarosDestinationVersion(
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
    const version = await AirbyteInit.getLatestFarosDestinationVersion();
    const listResponse = await this.api.post('/destination_definitions/list');
    const destDefs = listResponse.data.destinationDefinitions;
    const farosDestDef = find(
      destDefs,
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
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    throw new VError(
      'Usage: node init.js <airbyte url> [true|false force re-setup]'
    );
  }
  const [airbyteUrl, forceSetup] = args;
  const airbyte = new AirbyteInit(
    axios.create({
      baseURL: `${airbyteUrl}/api/v1`,
    })
  );

  const segmentUser = AirbyteInit.makeSegmentUser();
  await AirbyteInit.sendIdentity(segmentUser);

  await airbyte.waitUntilHealthy();
  await airbyte.setupWorkspace(segmentUser, forceSetup === 'true');
  await airbyte.setupFarosDestinationDefinition();
  logger.info('Airbyte setup is complete');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
