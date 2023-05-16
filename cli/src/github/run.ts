import {Octokit} from '@octokit/core';
import {Command, Option} from 'commander';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {wrapApiError} from '../cli';
import {Metabase} from '../metabase/metabase-client';
import {
  display,
  Emoji,
  errorLog,
  parseIntegerPositive,
  toStringList,
} from '../utils';
import {
  runAutoComplete,
  runList,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const DEFAULT_CUTOFF_DAYS = 30;

interface GithubConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
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
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.metabaseUsername,
      password: options.metabasePassword,
    });

    await runGithub({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runGithub(cfg: GithubConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      `Provide GitHub API token with read permissions:
      repo, read:org, read:user`
    );
    display('Note: GitHub Enterprise Server not yet supported');
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

  let repos = cfg.repoList;

  try {
    if (!repos || repos.length === 0) {
      try {
        if ((await getRepos(token)).length === 0) {
          throw new VError('No repos found');
        }
      } catch (error) {
        errorLog('No repos found with those credentials %s', Emoji.FAILURE);
        return;
      }
      let done = false;
      while (!done) {
        repos = await promptForRepos(token);

        if (repos.length === 0) {
          display(
            'Your selection was empty; remember to use the SPACEBAR to select!',
            Emoji.EMPTY
          );
          const tryAgainPrompt = await runSelect({
            name: 'tryAgainPrompt',
            message:
              // eslint-disable-next-line max-len
              'Do you want to try selecting again with the current credentials?',
            choices: ['Yes', 'No, let me start over'],
          });

          switch (tryAgainPrompt) {
            case 'Yes':
              continue;
            case 'No, let me start over':
              return;
          }
        }
        done = true;
      }
    }

    const githubSourceId = await cfg.airbyte.findFarosSource('GitHub');
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        repository: repos?.join(' '),
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        credentials: {
          option_title: 'PAT Credentials',
          personal_access_token: token,
        },
        page_size_for_large_streams: 10,
      },
      name: 'GitHub',
      sourceId: githubSourceId,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  const githubConnectionId = await cfg.airbyte.findFarosConnection(
    'GitHub - Faros'
  );
  await cfg.airbyte.triggerAndTrackSync(
    githubConnectionId,
    'GitHub',
    cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
    repos?.length || 0
  );

  try {
    await cfg.metabase.forceSync();
  } catch (error) {
    // main intent is to have filters immediately populated with values
    // we do nothing on failure, basic functionalities are not impacted
    // daily/hourly metabase db scans will eventually get us there
  }
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
        message:
          'Pick your favorite repos with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getRepos(token),
      });
    case 'Autocomplete from a list of repos your token has access to':
      return await runAutoComplete({
        name: 'repos',
        message:
          'Select your favorite repos with SPACEBAR; press ENTER when done',
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
    throw wrapApiError(err, 'Failed to get repos');
  });
  return response.data.map((repo) => repo.full_name);
}
