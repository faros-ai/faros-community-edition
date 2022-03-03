import {pino} from 'pino';
import VError from 'verror';

import {MockData} from './mockdata';

const USAGE = 'Usage: node init.js <upload> | <delete> <hasura url> ';

async function main(): Promise<void> {
  const logger = pino({name: 'faros-ce-mock-data'});
  const args = process.argv.slice(2);
  if (args.length < 2) {
    throw new VError(USAGE);
  }

  const [operation, url] = args;
  const mockData = new MockData(url);

  switch (operation) {
    case 'upload':
      logger.info('Initiating mock data upload.');
      await mockData.uploadData();
      logger.info('Mock data upload complete.');
      break;
    case 'delete':
      await mockData.deleteData();
      logger.info('Deleting mock data complete.');
      break;
    default:
      logger.error(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
