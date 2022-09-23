/**
 * Proxy AWS module. This was added to provide a helpful message when importing
 * the underlying SDK fails and only fail if the functionality is used. See
 * https://github.com/faros-ai/cli/issues/96 for more context.
 */
/* istanbul ignore file */
import {errorLog, wrap} from './';

export default ((): any => {
  try {
    return require('aws-sdk');
  } catch (err) {
    // We return a proxy to delay the error until the import is actually used.
    return new Proxy(
      {},
      {
        get: (): any => {
          errorLog(
            wrap([
              'Unable to import the AWS SDK. This is possibly due to ',
              'https://github.com/aws/aws-sdk-js/issues/2796.',
            ])
          );
          throw err;
        },
      }
    );
  }
})();
