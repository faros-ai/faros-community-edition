import {execSync} from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import pino from 'pino';

import {AirbyteClient, ConnectionConfiguration} from './airbyte-client';
import {HasuraClient} from './hasura-client';

const logger = pino({
    name: 'integration-tests',
    level: process.env.LOG_LEVEL || 'info',
});

let destinationId: string;
let hasuraAdminSecret: string;
let hasuraClient: HasuraClient;
let airbyteClient: AirbyteClient;

beforeAll(async () => {
    logger.info('beforeAll started');
  destinationId = process.env.DESTINATION_ID;
  hasuraAdminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  airbyteClient = new AirbyteClient('http://localhost:8000');
  await airbyteClient.waitUntilHealthy();

  hasuraClient = new HasuraClient('http://localhost:8080', hasuraAdminSecret);
  await hasuraClient.waitUntilHealthy();

  logger.info('beforeAll ended');
}, 5 * 60 * 1000);

describe('integration tests', () => {
  const RESOURCES_DIR = path.join(
    __dirname,
    '..',
    'resources',
    'faros-destination'
  );

  test('check connection to the Faros destination', async () => {
    logger.info('t1 started');
    expect(await airbyteClient.checkDestinationConnection(destinationId)).toBe(
      true
    );
    logger.info('t1 ended');
  }, 60 * 1000);

  test(
    'verify writes in Hasura',
    async () => {
        logger.info('t2 started');
      const connectionConfiguration: ConnectionConfiguration =
        await airbyteClient.getDestinationConnectionConfiguration(
          destinationId
        );

      connectionConfiguration.edition_configs.hasura_admin_secret =
        hasuraAdminSecret;

      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'integration-tests')
      );
      await fs.copy(RESOURCES_DIR, tmpDir, {recursive: true});
      await fs.writeFile(
        path.join(tmpDir, 'config.json'),
        JSON.stringify(connectionConfiguration),
        'utf-8'
      );

      writeRecords(tmpDir);
      await fs.remove(tmpDir);

      expect(await hasuraClient.getVcsUserCount()).toBe(1);
      logger.info('t2 ended');
    },
    60 * 1000
  );

  function writeRecords(tmpDir: string) {
    execSync(`docker pull farosai/airbyte-faros-destination \
    && cat ${tmpDir}/streams.in \
    | docker run -i --network host \
    --mount type=bind,source=${tmpDir},target=/integration-test \
    farosai/airbyte-faros-destination write \
    --catalog /integration-test/catalog.json \
    --config /integration-test/config.json`);
  }
});
