import { RequestID } from '@splytech-io/request-id';
import Application = require('koa');
import got = require('got');

const app = new Application();

// middleware sets response 'x-request-id' header if it's not already set
// and sets up an async hook so RequestID.getRequestId() at any point of the same stacktrace instance
// would return the same request-id
app.use(RequestID.middleware());

app.use(async () => {
  const result = await remoteCall();

  // even in async context RequestID.getRequestId() returns the same value
  console.assert(result === RequestID.getRequestId());
});

async function remoteCall() {
  await got('https://api.domain.com/endpoint', {
    headers: {
      // pass request-id to external call so it can be matched
      [RequestID.DEFAULT_HEADER_NAME]: RequestID.getRequestId(),
    },
  });

  // for demonstration purposes
  return RequestID.getRequestId();
}
