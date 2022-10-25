import {Command, Option} from 'commander';
import {Version3Client} from 'jira.js';
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
  runInput,
  runList,
  runMultiSelect,
  runPassword,
  runSelect,
} from '../utils/prompts';

const JIRA_SOURCE_ID = '22852029-670c-4296-958e-c581fa76ae98';
const JIRA_CONNECTION_ID = '577ceecf-a92a-4785-b385-c41112d7f537';
const DEFAULT_CUTOFF_DAYS = 30;

interface JiraConfig {
  readonly airbyte: Airbyte;
  readonly email?: string;
  readonly token?: string;
  readonly domain?: string;
  readonly projectList?: ReadonlyArray<string>;
  readonly cutoffDays?: number;
}

export function makeJiraCommand(): Command {
  const cmd = new Command()
    .name('jira')
    .option('--email <email>', 'Email')
    .option('--token <token>', 'Personal Access Token')
    .option('--domain <domain>', 'Domain (e.g. foobar.atlassian.net)')
    .addOption(
      new Option(
        '--project-list <project-list>',
        'Comma-separated list of projects keys to sync'
      ).argParser(toStringList)
    )
    .option(
      '--cutoff-days <cutoff-days>',
      'only fetch issues updated in the last ' + 'number of days',
      parseIntegerPositive,
      DEFAULT_CUTOFF_DAYS
    );

  cmd.action(async (options) => {
    const airbyte = new Airbyte(options.airbyteUrl);

    await runJira({...options, airbyte});
  });

  return cmd;
}

export async function runJira(cfg: JiraConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      `Visit our ${await terminalLink(
        'docs',
        'https://community.faros.ai/docs/faros-essentials#api-token-requirements'
      )} for token requirements`
    );
  }
  const domain =
    cfg.domain ||
    (await runInput({
      name: 'domain',
      message: 'Enter your domain (.atlassian.net will be automatically added)',
    })) + '.atlassian.net';
  const email =
    cfg.email ||
    (await runInput({
      name: 'email',
      message: 'Enter your email',
    }));
  const token =
    cfg.token ||
    (await runPassword({
      name: 'token',
      message: 'Enter your Personal Access Token',
    }));

  const jira = new Version3Client({
    ...{telemetry: false},
    host: 'https://' + domain,
    authentication: {
      basic: {
        email,
        apiToken: token,
      },
    },
  });

  const startDate = new Date();
  startDate.setDate(
    startDate.getDate() - (cfg.cutoffDays || DEFAULT_CUTOFF_DAYS)
  );

  try {
    const projects = cfg.projectList || (await promptForProjects(jira));

    if (projects.length === 0) {
      return;
    }

    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        email,
        api_token: token,
        domain,
        projects,
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        enable_experimental_streams: true,
        expand_issue_changelog: true,
      },
      name: 'Jira',
      sourceId: JIRA_SOURCE_ID,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  await cfg.airbyte.triggerAndTrackSync(JIRA_CONNECTION_ID);
}

async function promptForProjects(
  jira: Version3Client
): Promise<ReadonlyArray<string>> {
  const projectsPrompt = await runSelect({
    name: 'projectPrompt',
    message: 'How would you like to select your projects?',
    choices: [
      'Select from a list of project keys your token has access to',
      'Autocomplete from a list of project keys your token has access to',
      'I\'ll enter the project keys manually',
    ],
  });

  switch (projectsPrompt) {
    case 'Select from a list of project keys your token has access to':
      return await runMultiSelect({
        name: 'projects',
        message:
          'Pick your favorite projects with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getProjects(jira),
      });
    case 'Autocomplete from a list of project keys your token has access to':
      return await runAutoComplete({
        name: 'projects',
        message:
          'Select your favorite projects with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getProjects(jira),
        multiple: true,
      });
    case 'I\'ll enter the project keys manually':
      return await runList({
        name: 'projects',
        message:
          'Enter your favorite projects keys (comma-separated). ' +
          'E.g., FOO, BAR',
      });
  }

  return [];
}

async function getProjects(
  jira: Version3Client
): Promise<ReadonlyArray<string>> {
  const response = await jira.projects.getAllProjects().catch((err) => {
    throw new VError(err);
  });
  return response.map((project) => project.key);
}
