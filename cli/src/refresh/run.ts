import {Command} from 'commander';

import {Airbyte} from '../airbyte/airbyte-client';
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

  if (await cfg.airbyte.isActiveConnection('GitHub - Faros')) {
    display('refreshing GitHub %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh('GitHub - Faros', 'GitHub'));
  }

  if (await cfg.airbyte.isActiveConnection('GitLab - Faros')) {
    display('refreshing GitLab %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh('GitLab - Faros', 'GitLab'));
  }

  if (await cfg.airbyte.isActiveConnection('Bitbucket - Faros')) {
    display('refreshing Bitbucket %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh('Bitbucket - Faros', 'Bitbucket'));
  }

  if (await cfg.airbyte.isActiveConnection('Jira - Faros')) {
    display('refreshing Jira %s', Emoji.SYNC);
    work.push(cfg.airbyte.refresh('Jira - Faros', 'Jira'));
  }

  if (work.length === 0) {
    display('nothing to refresh');
  } else {
    await Promise.all(work);
  }
}
