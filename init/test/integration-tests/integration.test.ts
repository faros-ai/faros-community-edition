import {execSync} from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import {AirbyteClient, ConnectionConfiguration} from './airbyte-client';
import {HasuraClient} from './hasura-client';

let destinationId: string;
let hasuraAdminSecret: string;
let hasuraClient: HasuraClient;
let airbyteClient: AirbyteClient;

beforeAll(async () => {
  destinationId = process.env.DESTINATION_ID;
  hasuraAdminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  airbyteClient = new AirbyteClient('http://localhost:8000');
  await airbyteClient.waitUntilHealthy();

  hasuraClient = new HasuraClient('http://localhost:8080', hasuraAdminSecret);
  await hasuraClient.waitUntilHealthy();
}, 60 * 1000);

describe('integration tests', () => {
  const RESOURCES_DIR = path.join(
    __dirname,
    '..',
    'resources',
    'faros-destination'
  );

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

  test(
    'check events cli writes in Hasura',
    async () => {
      const origin = 'Faros_Script_Event';

      sendCIEvent(origin);

      expect(await hasuraClient.getCicdBuildCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdPipelineCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdOrganizationCount(origin)).toBe(2);
      expect(await hasuraClient.getCicdArtifactCount(origin)).toBe(1);
      expect(
        await hasuraClient.getCicdArtifactCommitAssociationCount(origin)
      ).toBe(1);
      expect(await hasuraClient.getCicdRepositoryCount(origin)).toBe(1);
      expect(
        await hasuraClient.getVcsPullRequestCommitAssociationCount(origin)
      ).toBe(1);
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

  function sendCIEvent(origin: string) {
    execSync(`docker pull farosai/faros-events-cli:latest \
    && docker run -i --network host farosai/faros-events-cli:latest CI \
    --run "<run_source>://<run_organization>/<run_pipeline>/<run_id>" \
    --commit "<commit_source>://<commit_organization>/<commit_repository>/<commit_sha>" \
    --pull_request_number 1 \
    --artifact "<artifact_source>://<artifact_organization>/<artifact_repository>/<artifact_id>" \
    --run_status "Success" \
    --run_status_details "Some extra details" \
    --run_start_time "1000" \
    --run_end_time "2000" \
    --hasura_admin_secret ${hasuraAdminSecret} \
    --origin ${origin} \
    --community_edition`);
  }
});
