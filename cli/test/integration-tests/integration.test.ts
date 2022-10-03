import path from 'path';

import {CLI} from '../cli';

let githubCfg: GithubConfig | undefined;
let bitbucketCfg: BitbucketConfig | undefined;

beforeAll(async () => {
  if (process.env.GITHUB_CLI_TEST_CFG) {
    githubCfg = JSON.parse(process.env.GITHUB_CLI_TEST_CFG);
  }

  if (process.env.BITBUCKET_CLI_TEST_CFG) {
    bitbucketCfg = JSON.parse(process.env.BITBUCKET_CLI_TEST_CFG);
  }
});

interface GithubConfig {
  readonly token: string;
  readonly repoList: ReadonlyArray<string>;
  readonly cutoffDays: number;
}

interface BitbucketConfig {
  readonly username: string;
  readonly password: string;
  readonly workspace: string;
  readonly repoList: ReadonlyArray<string>;
  readonly cutoffDays: number;
}

const EXPECTED_OUTPUT_SUCCESS_SYNC = [
  'Checking connection with Airbyte\n',
  'Setting up source\n',
  'Setup succeeded\n',
  'Syncing\n',
  'Syncing succeeded\n',
];

describe('index', () => {
  test('help', async () => {
    const cli = await run(['--help']);
    expect(await CLI.read(cli.stderr)).toBe('');
    expect(await CLI.read(cli.stdout)).toMatch(/^Usage: main*/);
    expect(await cli.wait()).toBe(0);
  });

  test(
    'github',
    async () => {
      const cli = await run([
        'github',
        '--token',
        githubCfg.token,
        '--repo-list',
        githubCfg.repoList.join(),
        '--cutoff-days',
        githubCfg.cutoffDays.toString(),
      ]);
      const lines = await CLI.readlines(cli.stdout);
      EXPECTED_OUTPUT_SUCCESS_SYNC.forEach((line) =>
        expect(lines).toContain(line)
      );
      expect(await cli.wait()).toBe(0);
    },
    2 * 60 * 1000
  );

  // Skip until the secret is available in GHA
  test.skip(
    'bitbucket',
    async () => {
      const cli = await run([
        'bitbucket',
        '--username',
        bitbucketCfg.username,
        '--password',
        bitbucketCfg.password,
        '--workspace',
        bitbucketCfg.workspace,
        '--repo-list',
        bitbucketCfg.repoList.join(),
        '--cutoff-days',
        bitbucketCfg.cutoffDays.toString(),
      ]);
      const lines = await CLI.readlines(cli.stdout);
      EXPECTED_OUTPUT_SUCCESS_SYNC.forEach((line) =>
        expect(lines).toContain(line)
      );
      expect(await cli.wait()).toBe(0);
    },
    2 * 60 * 1000
  );

  function run(args: string[]): Promise<CLI> {
    return CLI.runWith(args, {}, path.join(__dirname, '..', '..'), 'main');
  }
});
