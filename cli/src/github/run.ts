import {Octokit} from '@octokit/core';
import {Command, Option} from 'commander';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {
  display,
  Emoji,
  errorLog,
  parseIntegerPositive,
  terminalLink,
  toStringList,
} from '../utils';
import {
  runAutoComplete,
  runList,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const GITHUB_SOURCE_ID = '5d9079ca-8173-406f-bfdb-41f19c62daff';
const GITHUB_CONNECTION_ID = '6421df4e-0c5a-4666-a530-9c01de683518';
const DEFAULT_CUTOFF_DAYS = 30;

interface GithubConfig {
  readonly airbyte: Airbyte;
  readonly token?: string;
  readonly repoList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeGithubCommand(): Command {
  const cmd = new Command()
    .name('github')
    .option('--token <token>', 'Personal Access Token')
    .addOption(
      new Option(
        '--repo-list <repo-list>',
        'Comma-separated list of repos to sync'
      ).argParser(toStringList)
    )
    .option(
      '--cutoff-days <cutoff-days>',
      'only fetch commits, issues and pull requests updated in the last ' +
        'number of days',
      parseIntegerPositive,
      DEFAULT_CUTOFF_DAYS
    );

  cmd.action(async (options) => {
    const airbyte = new Airbyte(options.airbyteUrl);

    await runGithub({...options, airbyte});
  });

  return cmd;
}

export async function runGithub(cfg: GithubConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      `Visit our ${await terminalLink(
        'docs',
        'https://community.faros.ai/docs/faros-essentials#api-token-requirements'
      )} for token requirements`
    );
  }
  const token =
    cfg.token ||
    (await runPassword({
      name: 'token',
      message: 'Enter your Personal Access Token',
    }));

  const startDate = new Date();
  startDate.setDate(
    startDate.getDate() - (cfg.cutoffDays || DEFAULT_CUTOFF_DAYS)
  );

  try {
    const repos = cfg.repoList || (await promptForRepos(token));

    if (repos.length === 0) {
      return;
    }

    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        repository: repos.join(' '),
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        credentials: {
          option_title: 'PAT Credentials',
          personal_access_token: token,
        },
        page_size_for_large_streams: 10,
      },
      name: 'GitHub',
      sourceId: GITHUB_SOURCE_ID,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  await cfg.airbyte.triggerAndTrackSync(GITHUB_CONNECTION_ID);
}

async function promptForRepos(token: string): Promise<ReadonlyArray<string>> {
  const reposPrompt = await runSelect({
    name: 'reposPrompt',
    message: 'How would you like to select your repos?',
    choices: [
      'Select from a list of repos your token has access to',
      'Autocomplete from a list of repos your token has access to',
      'I\'ll enter them manually',
    ],
  });

  switch (reposPrompt) {
    case 'Select from a list of repos your token has access to':
      return await runMultiSelect({
        name: 'repos',
        message: 'Pick your favorite repos',
        limit: 10,
        choices: await getRepos(token),
      });
    case 'Autocomplete from a list of repos your token has access to':
      return await runAutoComplete({
        name: 'repos',
        message: 'Select your favorite repos',
        limit: 10,
        choices: await getRepos(token),
        multiple: true,
      });
    case 'I\'ll enter them manually':
      return await runList({
        name: 'repos',
        message:
          'Enter your favorite repos (comma-separated). ' +
          'E.g., faros-ai/faros-community-edition, faros-ai/airbyte-local-cli',
      });
  }

  return [];
}

async function getRepos(token: string): Promise<ReadonlyArray<string>> {
  const octokit = new Octokit({auth: token});
  const response = await octokit.request('GET /user/repos', {}).catch((err) => {
    throw new VError(err);
  });
  return response.data.map((repo) => repo.full_name);
}
