import path from 'path';

import {CLI} from '../cli';

const EXPECTED_OUTPUT_SUCCESS_SYNC = [
  'Checking connection with Airbyte \n',
  'Setting up source \n',
  'Setup succeeded \n',
  'GitHub sync succeeded \n',
];

const EXPECTED_OUTPUT_SUCCESS_REFRESH = [
  'Checking connection with Airbyte \n',
  'refreshing GitHub \n',
  'GitHub sync succeeded \n',
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
        process.env.GITHUB_TOKEN,
        '--repo-list',
        'faros-ai/faros-community-edition',
        '--cutoff-days',
        '1',
      ]);
      const lines = await CLI.readlines(cli.stdout);
      EXPECTED_OUTPUT_SUCCESS_SYNC.forEach((line) =>
        expect(lines).toContain(line)
      );
      expect(await cli.wait()).toBe(0);
    },
    2 * 60 * 1000
  );

  test(
    'refresh',
    async () => {
      const cli = await run(['refresh-sources']);
      const lines = await CLI.readlines(cli.stdout);
      EXPECTED_OUTPUT_SUCCESS_REFRESH.forEach((line) =>
        expect(lines).toContain(line)
      );
      expect(await cli.wait()).toBe(0);
    },
    2 * 60 * 1000
  );

  function run(args: string[]): Promise<CLI> {
    return CLI.runWith(args, path.join(__dirname, '..', '..'), 'main', {
      env: {FAROS_NO_EMOJI: '1'},
    });
  }
});
