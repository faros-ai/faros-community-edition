import {Command, Option} from 'commander';
import {Version3Client} from 'jira.js';
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

interface JiraConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
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
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.metabaseUsername,
      password: options.metabasePassword,
    });

    await runJira({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runJira(cfg: JiraConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  if (!cfg.token) {
    display(
      `The integration user needs application access to Jira,
      the 'Browse Users' global permission,
      the 'Browse Project' permission for each project,
      and the 'View Development Tools' permission for each project`
    );
    display('Note: Jira Server/DC not yet supported');
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
  const jira_url = new URL('https://' + domain);
  const jira = new Version3Client({
    ...{telemetry: false},
    host: jira_url.href,
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

  let projects = cfg.projectList;

  try {
    if (!projects || projects.length === 0) {
      try {
        if ((await getProjects(jira)).length === 0) {
          throw new VError('No projects found');
        }
      } catch (error) {
        errorLog('No projects found with those credentials %s', Emoji.FAILURE);
        return;
      }
      let done = false;
      while (!done) {
        projects = await promptForProjects(jira);

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

    const jiraSourceId = await cfg.airbyte.findFarosSource('Jira');
    await cfg.airbyte.setupSource({
      connectionConfiguration: {
        email,
        api_token: token,
        domain,
        projects,
        start_date: startDate.toISOString().replace(/\.\d+/, ''),
        render_fields: true,
        enable_experimental_streams: true,
        expand_issue_changelog: true,
      },
      name: 'Jira',
      sourceId: jiraSourceId,
    });
  } catch (error) {
    errorLog('Setup failed %s', Emoji.FAILURE, error);
    return;
  }

  const jiraConnectionId = await cfg.airbyte.findFarosConnection(
    'Jira - Faros'
  );
  await cfg.airbyte.triggerAndTrackSync(
    jiraConnectionId,
    'Jira',
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
  jira: Version3Client
): Promise<ReadonlyArray<string>> {
  const projectsPrompt = await runSelect({
    name: 'projectPrompt',
    message: 'How would you like to select your projects?',
    choices: [
      'Select from a list of projects your token has access to',
      'Autocomplete from a list of projects your token has access to',
      'I\'ll enter the project keys manually',
    ],
  });

  switch (projectsPrompt) {
    case 'Select from a list of projects your token has access to':
      return await runMultiSelect({
        name: 'projects',
        message:
          'Pick your favorite projects with SPACEBAR; press ENTER when done',
        limit: 10,
        choices: await getProjects(jira),
      });
    case 'Autocomplete from a list of projects your token has access to':
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
          'Enter your favorite projects keys (comma-separated).' +
          'E.g., FOO, BAR',
      });
  }

  return [];
}

async function getProjects(
  jira: Version3Client
): Promise<ReadonlyArray<string>> {
  const response = await jira.projects.getAllProjects().catch((err) => {
    throw wrapApiError(err, 'Failed to get projects');
  });
  return response.map((project) => project.key);
}
