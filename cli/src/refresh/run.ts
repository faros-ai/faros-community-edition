import {Command} from 'commander';

import {Airbyte} from '../airbyte/airbyte-client';
import {BITBUCKET_CONNECTION_ID} from '../bitbucket/run';
import {GITHUB_CONNECTION_ID} from '../github/run';
import {GITLAB_CONNECTION_ID} from '../gitlab/run';
import {JIRA_CONNECTION_ID} from '../jira/run';
import {Metabase} from '../metabase/metabase-client';
import {display, Emoji} from '../utils';

interface RefreshConfig {
  readonly airbyte: Airbyte;
  readonly metabase: Metabase;
}

export function makeRefreshCommand(): Command {
  const cmd = new Command().name('refresh-sources');

  cmd.action(async (options) => {
    const airbyte = new Airbyte(options.airbyteUrl);
    const metabase = await Metabase.fromConfig({
      url: options.metabaseUrl,
      username: options.metabaseUsername,
      password: options.metabasePassword,
    });

    await runRefresh({...options, airbyte, metabase});
  });

  return cmd;
}

export async function runRefresh(cfg: RefreshConfig): Promise<void> {
  await cfg.airbyte.waitUntilHealthy();
  const work = [];

  if (await cfg.airbyte.isActiveConnection(GITHUB_CONNECTION_ID)) {
    display('refreshing GitHub %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh(GITHUB_CONNECTION_ID, 'GitHub'));
  }

  if (await cfg.airbyte.isActiveConnection(GITLAB_CONNECTION_ID)) {
    display('refreshing GitLab %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh(GITLAB_CONNECTION_ID, 'GitLab'));
  }

  if (await cfg.airbyte.isActiveConnection(BITBUCKET_CONNECTION_ID)) {
    display('refreshing Bitbucket %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh(BITBUCKET_CONNECTION_ID, 'Bitbucket'));
  }

  if (await cfg.airbyte.isActiveConnection(JIRA_CONNECTION_ID)) {
    display('refreshing Jira %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh(JIRA_CONNECTION_ID, 'Jira'));
  }

  if (work.length === 0) {
    display('nothing to refresh');
  } else {
    await Promise.all(work);
  }
}
