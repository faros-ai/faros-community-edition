import axios from 'axios';
import {program} from 'commander';

import {Airbyte} from './airbyte/airbyte-client';
import {makeBitbucketCommand, runBitbucket} from './bitbucket/run';
import {makeGithubCommand, runGithub} from './github/run';
import {runSelect} from './utils/prompts';

const DEFAULT_AIRBYTE_URL = 'http://localhost:8000';

export async function main(): Promise<void> {
  program.addCommand(makeBitbucketCommand());
  program.addCommand(makeGithubCommand());

  // Commander doesn't allow for empty subcommand names, even if the subcommand
  // is marked as default. Users can omit the subcommand below though, which is
  // the behavior we want. We just need to name it something to make commander
  // happy.
  program.command('pick-source', {isDefault: true}).action(async (options) => {
    const airbyte = new Airbyte(
      options.airbyteUrl
    );

    const source = await runSelect({
      name: 'source',
      message: 'Select a source',
      choices: ['bitbucket', 'github'],
    });

    switch (source) {
      case 'bitbucket':
        runBitbucket({airbyte});
        break;
      case 'github':
        runGithub({airbyte});
        break;
    }
  });

  program.commands.forEach((cmd) => {
    cmd.option('--airbyte-url <string>', 'Airbyte URL', DEFAULT_AIRBYTE_URL);
  });

  program.parse();
}
