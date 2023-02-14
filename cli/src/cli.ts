import {program} from 'commander';
import {VError} from 'verror';

import {Airbyte} from './airbyte/airbyte-client';
import {makeBitbucketCommand, runBitbucket} from './bitbucket/run';
import {makeGithubCommand, runGithub} from './github/run';
import {makeGitlabCommand, runGitlab} from './gitlab/run';
import {makeJiraCommand, runJira} from './jira/run';
import {Metabase} from './metabase/metabase-client';
import {makeRefreshCommand, runRefresh} from './refresh/run';
import {display, Emoji, terminalLink} from './utils';
import {runSelect} from './utils/prompts';

const DEFAULT_AIRBYTE_URL = 'http://localhost:8000';
const DEFAULT_METABASE_URL = 'http://localhost:3000';
const DEFAULT_METABASE_USER = 'admin@admin.com';
const DEFAULT_METABASE_PASSWORD = 'admin';

export function wrapApiError(cause: unknown, msg: string): Error {
  // Omit verbose axios error
  const truncated = new VError((cause as Error).message);
  return new VError(truncated, msg);
}

// eslint-disable-next-line require-await
export async function main(): Promise<void> {
  program.addCommand(makeGithubCommand());
  program.addCommand(makeGitlabCommand());
  program.addCommand(makeBitbucketCommand());
  program.addCommand(makeJiraCommand());
  program.addCommand(makeRefreshCommand());

  // Commander doesn't allow for empty subcommand names, even if the subcommand
  // is marked as default. Users can omit the subcommand below though, which is
  // the behavior we want. We just need to name it something to make commander
  // happy.
  program
    .command('pick-source', {isDefault: true, hidden: true})
    .action(async (options) => {
      const airbyte = new Airbyte(options.airbyteUrl);
      const metabase = await Metabase.fromConfig({
        url: options.metabaseUrl,
        username: options.metabaseUsername,
        password: options.metabasePassword,
      });

      let done = false;
      while (!done) {
        const source = await runSelect({
          name: 'source',
          message: 'Select a source',
          choices: [
            'GitHub (Cloud)',
            'GitLab (Cloud / Server)',
            'Bitbucket (Cloud)',
            'Jira (Cloud)',
            'Refresh existing sources',
            'I\'m done!',
          ],
        });
        switch (source) {
          case 'GitHub (Cloud)':
            await runGithub({airbyte, metabase});
            break;
          case 'GitLab (Cloud / Server)':
            await runGitlab({airbyte, metabase});
            break;
          case 'Bitbucket (Cloud)':
            await runBitbucket({airbyte, metabase});
            break;
          case 'Jira (Cloud)':
            await runJira({airbyte, metabase});
            break;
          case 'Refresh existing sources':
            await runRefresh({airbyte, metabase});
            break;
          case 'I\'m done!':
            done = true;
        }
      }
    });

  program.commands.forEach((cmd) => {
    cmd.option('--airbyte-url <string>', 'Airbyte URL', DEFAULT_AIRBYTE_URL);
    cmd
      .option('--metabase-url <string>', 'Metabase URL', DEFAULT_METABASE_URL)
      .option(
        '--metabase-username <string>',
        'Metabase username',
        DEFAULT_METABASE_USER
      )
      .option(
        '--metabase-password <string>',
        'Metabase password',
        DEFAULT_METABASE_PASSWORD
      )
      .hook('preAction', async () => {
        display('%s Welcome to Faros Essentials!', Emoji.HELLO);
        display(
          `For documentation, please see this ${await terminalLink(
            'page',
            'https://community.faros.ai/docs/faros-essentials'
          )}.`
        );
      })
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
        display(
          `Configure sync schedule in ${await terminalLink(
            'Airbyte',
            thisCommand.opts().airbyteUrl
          )}`
        );
        display('You can run this CLI again with ./run_cli.sh');
        display('You can stop Faros with ./stop.sh');
        display(
          `For help, go to this ${await terminalLink(
            'page',
            'https://community.faros.ai/docs/faros-essentials'
          )}.`
        );
      });
  });

  program.parse();
}
