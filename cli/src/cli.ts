import {program} from 'commander';
import {VError} from 'verror';
import {runGithub} from './github/run';
import axios from 'axios';
import {Airbyte} from './airbyte/airbyte-client';
import {runSelect} from './utils/prompts';
import {runBitbucket} from './bitbucket/run';

const DEFAULT_AIRBYTE_URL = 'http://localhost:8000';

export async function main(): Promise<void> {
  program.option('--airbyte-url <string>', 'Airbyte URL', DEFAULT_AIRBYTE_URL);
  program.parse();
  const options = program.opts();

  const airbyte = new Airbyte(
    axios.create({
      baseURL: `${options.airbyteUrl}/api/v1`,
    })
  );

  await airbyte.waitUntilHealthy();

  const source = await runSelect({
    name: 'source',
    message: 'Select a source',
    choices: ['bitbucket', 'github' /*'gitlab', 'jira'*/],
  });

  switch (source) {
    case 'bitbucket':
      runBitbucket(airbyte);
      break;
    case 'github':
      runGithub(airbyte);
      break;
    default:
      throw new VError('Not implemented');
  }
}
