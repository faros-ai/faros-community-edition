import {program} from 'commander';

import {Airbyte} from './airbyte/airbyte-client';
import {makeBitbucketCommand, runBitbucket} from './bitbucket/run';
import {makeGithubCommand, runGithub} from './github/run';
import {display, terminalLink} from './utils';
import {runSelect} from './utils/prompts';

const DEFAULT_AIRBYTE_URL = 'http://localhost:8000';
const DEFAULT_METABASE_URL = 'http://localhost:3000';

export async function main(): Promise<void> {
  program.addCommand(makeBitbucketCommand());
  program.addCommand(makeGithubCommand());

  // Commander doesn't allow for empty subcommand names, even if the subcommand
  // is marked as default. Users can omit the subcommand below though, which is
  // the behavior we want. We just need to name it something to make commander
  // happy.
  program
    .command('pick-source', {isDefault: true, hidden: true})
    .action(async (options) => {
      const airbyte = new Airbyte(options.airbyteUrl);

      const source = await runSelect({
        name: 'source',
        message: 'Select a source',
        choices: ['bitbucket', 'github'],
      });

      switch (source) {
        case 'bitbucket':
          await runBitbucket({airbyte});
          break;
        case 'github':
          await runGithub({airbyte});
          break;
      }
    });

  program.commands.forEach((cmd) => {
    cmd.option('--airbyte-url <string>', 'Airbyte URL', DEFAULT_AIRBYTE_URL);
    cmd
      .option('--metabase-url <string>', 'Metabase URL', DEFAULT_METABASE_URL)
      .hook('postAction', async (thisCommand) => {
        display(
          `Check out your metrics in ${await terminalLink(
            'Metabase',
            thisCommand.opts().metabaseUrl
          )}`
        );
        display(
          'Default admin login credentials are admin@admin.com / admin. ' +
            `To learn how to set them, visit ${await terminalLink(
              'Setting Admin Credentials page',
              'https://community.faros.ai/docs/setting-admin-credentials'
            )}.`
        );
      });
  });

  program.parse();
}
