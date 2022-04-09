import {execSync} from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import {AirbyteClient, ConnectionConfiguration} from './airbyte-client';
import {HasuraClient} from './hasura-client';

describe('integration tests', () => {
  const RESOURCES_DIR = path.join(
    __dirname,
    '..',
    'resources',
    'faros-destination'
  );

  let destinationId: string;
  let hasuraAdminSecret: string;
  let hasuraClient: HasuraClient;
  let airbyteClient: AirbyteClient;

  beforeAll(async () => {
    destinationId = process.env.DESTINATION_ID;
    hasuraAdminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
    console.log('@integration tests, process.env=%o', process.env);
    console.log('@integration tests, destinationId=%s', destinationId);
    console.log('@integration tests, hasuraAdminSecret=%s', hasuraAdminSecret);

    hasuraClient = new HasuraClient('http://localhost:8080', hasuraAdminSecret);
    await hasuraClient.waitUntilHealthy();

    airbyteClient = new AirbyteClient('http://localhost:8000');
    await airbyteClient.waitUntilHealthy();
  }, 60 * 1000);

  test('check connection to the Faros destination', async () => {
    expect(await airbyteClient.checkDestinationConnection(destinationId)).toBe(
      true
    );
  });

  test(
    'verify writes in Hasura',
    async () => {
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
    },
    60 * 1000
  );

  function writeRecords(tmpDir: string) {
    console.log(
      execSync(`docker pull farosai/airbyte-faros-destination \
    && cat ${tmpDir}/streams.in \
    | docker run -i --network host \
    --mount type=bind,source=${tmpDir},target=/integration-test \
    farosai/airbyte-faros-destination write \
    --catalog /integration-test/catalog.json \
    --config /integration-test/config.json`).toString()
    );
  }
});
