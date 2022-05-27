import {execSync} from 'child_process';
import fs from 'fs-extra';
import {isEqual} from 'lodash';
import os from 'os';
import path from 'path';

import {AirbyteClient, ConnectionConfiguration} from './airbyte-client';
import {HasuraClient} from './hasura-client';
import {TestDefinition} from './types';

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
  const RESOURCES_DIR = path.join(__dirname, '..', 'resources');

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
      const directory = path.join(RESOURCES_DIR, 'faros-destination');
      await fs.copy(directory, tmpDir, {recursive: true});
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
    'check CI event writes in Hasura',
    async () => {
      const origin = 'CI_test';

      sendCIEvent(origin);

      expect(await hasuraClient.getCicdBuildCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdPipelineCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdOrganizationCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdArtifactCount(origin)).toBe(1);
      expect(
        await hasuraClient.getCicdArtifactCommitAssociationCount(origin)
      ).toBe(1);
      expect(await hasuraClient.getCicdRepositoryCount(origin)).toBe(1);
      expect(await hasuraClient.getVcsPullRequestCommitCount(origin)).toBe(1);
    },
    60 * 1000
  );

  test(
    'check CD event writes in Hasura',
    async () => {
      const origin = 'CD_test';

      sendCDEvent(origin);

      expect(await hasuraClient.getComputeApplicationCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdArtifactDeploymentCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdArtifactCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdDeploymentCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdBuildCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdPipelineCount(origin)).toBe(1);
      expect(await hasuraClient.getCicdOrganizationCount(origin)).toBe(1);
    },
    60 * 1000
  );

  test(
    'check cicd_organization Hasura endpoint',
    async () => {
      await loadTestDefinition('cicd_organization.json').then((test) =>
        checkHasuraEndpoint(test)
      );
    },
    5 * 1000
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
    --run "GitHub://faros-ai/faros-community-edition/123" \
    --commit "GitHub://faros-ai/faros-community-edition/XYZ" \
    --pull_request_number 1 \
    --artifact "GitHub://faros-ai/faros-community-edition/456" \
    --run_status "Success" \
    --run_status_details "Some extra details" \
    --run_start_time "1000" \
    --run_end_time "2000" \
    --hasura_admin_secret ${hasuraAdminSecret} \
    --origin ${origin} \
    --community_edition`);
  }

  function sendCDEvent(origin: string) {
    execSync(`docker pull farosai/faros-events-cli:latest \
    && docker run -i --network host farosai/faros-events-cli:latest CD \
    --run "GitHub://soraf-ai/faros-community-edition/123" \
    --artifact "GitHub://soraf-ai/faros-community-edition/456" \
    --run_status "Success" \
    --run_status_details "Some extra details" \
    --run_start_time "1000" \
    --run_end_time "2000" \
    --deploy "GitHub://faros/prod/789" \
    --deploy_status "Success" \
    --deploy_start_time "3000" \
    --deploy_end_time "4000" \
    --hasura_admin_secret ${hasuraAdminSecret} \
    --origin ${origin} \
    --community_edition`);
  }

  async function loadTestDefinition(
    testDefinitionFileName: string
  ): Promise<TestDefinition> {
    const directory = path.join(RESOURCES_DIR, 'hasura', 'test_definitions');

    return JSON.parse(
      await fs.readFile(path.join(directory, testDefinitionFileName), 'utf8')
    );
  }

  async function checkHasuraEndpoint(test: TestDefinition) {
    const directory = path.join(RESOURCES_DIR, 'hasura', 'test_data');

    const input = await fs.readFile(path.join(directory, test.input), 'utf8');
    const expectedOutput = await fs.readFile(
      path.join(directory, test.output),
      'utf8'
    );
    const query = await fs.readFile(path.join(directory, test.query), 'utf8');

    await hasuraClient.hitEndpoint(test.endpoint, input);
    const output = await hasuraClient.makeQuery(query);

    expect(isEqual(output, JSON.parse(expectedOutput))).toBe(true);
  }
});
