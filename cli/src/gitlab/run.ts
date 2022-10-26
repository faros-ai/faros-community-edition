import {Gitlab} from '@gitbeaker/node';
import {Command, Option} from 'commander';
import VError from 'verror';

import {Airbyte} from '../airbyte/airbyte-client';
import {wrapApiError} from '../cli';
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
  runInput,
  runList,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const GITLAB_SOURCE_ID = '59c74ca4-8cbb-4c65-8cb7-66bf771190fb';
const GITLAB_CONNECTION_ID = 'cef1b90d-ab16-4645-a0e3-b81818b8ffc7';
const DEFAULT_CUTOFF_DAYS = 30;

interface GitLabConfig {
  readonly airbyte: Airbyte;
  readonly apiUrl?: string;
  readonly token?: string;
  readonly projectList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeGitlabCommand(): Command {
  const cmd = new Command()
    .name('gitlab')
    .option('--api-url <api-url>', 'API URL, e.g. gitlab.com')
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

    await runGitlab({...options, airbyte});
  });

  return cmd;
}

export async function runGitlab(cfg: GitLabConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      `Visit our ${await terminalLink(
        'docs',
        'https://community.faros.ai/docs/faros-essentials#api-token-requirements'
      )} for token requirements`
    );
  }
  const api_url =
    cfg.apiUrl ||
    (await runInput({
      name: 'api_url',
      message: 'Enter the API URL (e.g. gitlab.com)',
    }));
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
    const projects =
      cfg.projectList || (await promptForProjects(token, api_url));

    if (projects.length === 0) {
      return;
    }

    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        api_url,
        projects: projects.join(' '),
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        private_token: token,
      },
      name: 'GitLab',
      sourceId: GITLAB_SOURCE_ID,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  await cfg.airbyte.triggerAndTrackSync(GITLAB_CONNECTION_ID);
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
      "I'll enter them manually",
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
    case "I'll enter them manually":
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
