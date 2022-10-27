import path from 'path';

import {CLI} from '../cli';

const EXPECTED_OUTPUT_SUCCESS_SYNC = [
  'Checking connection with Airbyte \n',
  'Setting up source \n',
  'Setup succeeded \n',
  'Syncing succeeded \n',
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

  function run(args: string[]): Promise<CLI> {
    return CLI.runWith(
      args,
      {env: {FAROS_NO_EMOJI: '1'}},
      path.join(__dirname, '..', '..'),
      'main'
    );
  }
});
