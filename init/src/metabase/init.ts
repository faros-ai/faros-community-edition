import pino from 'pino';
import {VError} from 'verror';

import {Dashboards} from './dashboards';

const USAGE =
  'Usage: node init.js ' +
  '<metabase url> <username> <password> <export <dashboardId> | import>';

const logger = pino({
  name: 'metabase-init',
  level: process.env.LOG_LEVEL || 'info',
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error(USAGE);
    process.exit(1);
  }
  const [url, username, password, operation, dashboardId] = args;
  const dashboards = await Dashboards.fromConfig({
    metabase: {url, username, password},
    // TODO: Pass databaseName as argument
    databaseName: 'faros',
    logger,
  });
  switch (operation) {
    case 'export':
      if (!dashboardId) {
        throw new VError('Must specify dashboard id to export');
      }
      console.log(await dashboards.export(parseInt(dashboardId, 10)));
      break;
    case 'import':
      await dashboards.import();
      logger.info('Metabase import is complete');
      break;
    default:
      console.error(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
