import {Gitlab} from '@gitbeaker/node';
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
  runInput,
  runList,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const DEFAULT_CUTOFF_DAYS = 30;
const DEFAULT_API_URL = 'gitlab.com';

interface GitLabConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
  readonly apiUrl?: string;
  readonly token?: string;
  readonly projectList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeGitlabCommand(): Command {
  const cmd = new Command()
    .name('gitlab')
    .option('--api-url <api-url>', 'API URL, defaults to gitlab.com')
    .option('--token <token>', 'Personal Access Token')
    .addOption(
      new Option(
        '--project-list <project-list>',
        'Comma-separated list of projects to sync'
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

    await runGitlab({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runGitlab(cfg: GitLabConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      'Provide GitLab personal access token with read permissions: read_api'
    );
  }
  const api_url =
    cfg.apiUrl ||
    (await runInput({
      name: 'api_url',
      message: 'Enter the API URL (defaults to e.g. gitlab.com)',
    })) ||
    DEFAULT_API_URL;
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

  let projects = cfg.projectList;

  try {
    if (!projects || projects.length === 0) {
      try {
        if ((await getProjects(token, api_url)).length === 0) {
          throw new VError('No projects found');
        }
      } catch (error) {
        errorLog('No projects found with those credentials %s', Emoji.FAILURE);
        return;
      }
      let done = false;
      while (!done) {
        projects = await promptForProjects(token, api_url);

        if (projects.length === 0) {
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

    const gitlabSourceId = await cfg.airbyte.findFarosSource('GitLab');
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        api_url,
        projects: projects?.join(' '),
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        private_token: token,
      },
      name: 'GitLab',
      sourceId: gitlabSourceId,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  const gitlabConnectionId = await cfg.airbyte.findFarosConnection(
    'GitLab - Faros'
  );
  await cfg.airbyte.triggerAndTrackSync(
    gitlabConnectionId,
    'GitLab',
    cfg.cutoffDays || DEFAULT_CUTOFF_DAYS,
    projects?.length || 0
  );

  try {
    await cfg.metabase.forceSync();
  } catch (error) {
    // main intent is to have filters immediately populated with values
    // we do nothing on failure, basic functionalities are not impacted
    // daily/hourly metabase db scans will eventually get us there
  }
}

async function promptForProjects(
  token: string,
  api_url: string
): Promise<ReadonlyArray<string>> {
  const projectsPrompt = await runSelect({
    name: 'projectsPrompt',
    message: 'How would you like to select your projects?',
    choices: [
      'Select from a list of projects your token has access to',
      'Autocomplete from a list of projects your token has access to',
      'I\'ll enter them manually',
    ],
  });

  switch (projectsPrompt) {
    case 'Select from a list of projects your token has access to':
      return await runMultiSelect({
        name: 'projects',
        message:
          'Pick your favorite projects with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getProjects(token, api_url),
      });
    case 'Autocomplete from a list of projects your token has access to':
      return await runAutoComplete({
        name: 'projects',
        message:
          'Select your favorite projects with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getProjects(token, api_url),
        multiple: true,
      });
    case 'I\'ll enter them manually':
      return await runList({
        name: 'projects',
        message:
          'Enter your favorite projects with their group, comma-separated. ' +
          'E.g., airbyte.io/documentation, meltano/tap-gitlab',
      });
  }

  return [];
}

async function getProjects(
  token: string,
  api_url: string
): Promise<ReadonlyArray<string>> {
  const gitlab_url = new URL('https://' + api_url);
  const gitlab = new Gitlab({
    host: gitlab_url.href,
    token,
  });
  const response = await gitlab.Projects.all({membership: true}).catch(
    (err) => {
      throw wrapApiError(err, 'Failed to get projects');
    }
  );
  return response.map((project) => project.path_with_namespace);
}
