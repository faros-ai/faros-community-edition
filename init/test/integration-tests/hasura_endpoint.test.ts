import fs from 'fs-extra';
import {isEqual} from 'lodash';
import path from 'path';

import {HasuraClient} from './hasura-client';
import {TestDefinition} from './types';

let hasuraAdminSecret: string;
let hasuraClient: HasuraClient;

beforeAll(async () => {
  hasuraAdminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  hasuraClient = new HasuraClient('http://localhost:8080', hasuraAdminSecret);
  await hasuraClient.waitUntilHealthy();
}, 60 * 1000);

describe('hasura endpoint tests', () => {
  const RESOURCES_DIR = path.join(__dirname, '..', 'resources');

  test('check cicd_organization Hasura endpoint', async () => {
    await loadTestDefinition('cicd_organization.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_organization_from_run Hasura endpoint', async () => {
    await loadTestDefinition('cicd_organization_from_run.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_artifact Hasura endpoint', async () => {
    await loadTestDefinition('cicd_artifact.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_artifact_commit_association Hasura endpoint', async () => {
    await loadTestDefinition('cicd_artifact_commit_association.json').then(
      (test) => checkHasuraEndpoint(test)
    );
  });

  test('check cicd_artifact_deployment Hasura endpoint', async () => {
    await loadTestDefinition('cicd_artifact_deployment.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_artifact_with_build Hasura endpoint', async () => {
    await loadTestDefinition('cicd_artifact_with_build.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_build Hasura endpoint', async () => {
    await loadTestDefinition('cicd_build.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_build_with_start_end Hasura endpoint', async () => {
    await loadTestDefinition('cicd_build_with_start_end.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_pipeline Hasura endpoint', async () => {
    await loadTestDefinition('cicd_pipeline.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check cicd_repository Hasura endpoint', async () => {
    await loadTestDefinition('cicd_repository.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

  test('check compute_application Hasura endpoint', async () => {
    await loadTestDefinition('compute_application.json').then((test) =>
      checkHasuraEndpoint(test)
    );
  });

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
