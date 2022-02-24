import retry from 'async-retry';
import axios, {AxiosInstance} from 'axios';
import fs from 'fs-extra';
import handlebars from 'handlebars';
import {find} from 'lodash';
import os from 'os';
import path from 'path';
import pino from 'pino';
import tar from 'tar';
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

class AirbyteInit {
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

  private static getSegmentUserId(): string {
    if (process.env.HOSTNAME) {
      return uuidv5(process.env.HOSTNAME, UUID_NAMESPACE);
    }
    return uuidv4();
  }

  async setupWorkspace(forceSetup?: boolean): Promise<void> {
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
        segment_user_id: AirbyteInit.getSegmentUserId(),
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

  async setupFarosDestinationDefinition(version: string): Promise<void> {
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
    } else if (farosDestDef.dockerImageTag > version) {
      logger.info(
        'Faros Destination is already at a newer version: %s',
        farosDestDef.dockerImageTag
      );
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
  if (args.length < 2) {
    throw new VError(
      'Usage: node init.js' +
        ' <airbyte url> <faros destination version>' +
        ' [true|false force re-setup]'
    );
  }
  const [airbyteUrl, farosDestVersion, forceSetup] = args;
  const airbyte = new AirbyteInit(
    axios.create({
      baseURL: `${airbyteUrl}/api/v1`,
    })
  );

  await airbyte.waitUntilHealthy();
  await airbyte.setupWorkspace(forceSetup === 'true');
  await airbyte.setupFarosDestinationDefinition(farosDestVersion);
  logger.info('Airbyte setup is complete');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
