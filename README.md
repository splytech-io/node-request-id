# @splytech-io/request-id

# [BUG in node v10](https://github.com/nodejs/node/issues/20274)

Helps to track requests between microservices. 

This library is utilising native `async_hooks` module and only calls `executionAsyncId()` function to get unique async stacktrace id. This makes sure same RequestID is always returned in the same request context.

Request ID's are generated using UUID v4.

### Example

```typescript
import { RequestID } from '@splytech-io/request-id';
import Application = require('koa');
import got = require('got');

const app = new Application();

// middleware sets response 'x-request-id' header if it's not already set
// and sets up an async hook so RequestID.getRequestId() at any point of the same stacktrace instance
// would return the same request-id
app.use(RequestID.middleware());

app.use(async () => {
  // async app logic goes here
  const result = await remoteCall();

  // even in async context RequestID.getRequestId() returns the same value
  console.assert(result === RequestID.getAsyncContextId());
});

async function remoteCall() {
  await got('https://api.domain.com/endpoint', {
    headers: {
      // pass request-id to external (microservice) call so external call 
      // can be matched against source request
      [RequestID.DEFAULT_HEADER_NAME]: RequestID.getAsyncContextId(),
    },
  });

  // for demonstration purposes
  return RequestID.getAsyncContextId();
}

```

## API

#### RequestID.middleware(options?: Options): Application.Middleware

```typescript
interface Options {
  // prefixes newly generated request-id with defined string
  prefix?: string; 
  
  // header name to use when setting response and 
  // reading request headers. Defaults to `x-request-id`
  headerName?: string;
}
```

Returns a Koa middleware which generates request-id using uuid library **if header is not already set**. 


#### RequestID.getRequestID(): string | undefined

Returns a unique request identifier. Must be called in request context.

Returns `undefined` if called outside of request context, ie called before `RequestID.middleware()` or inside `setTimeout()` call. 

More info [nodejs.org/async_hooks](https://nodejs.org/api/async_hooks.html#async_hooks_async_hooks_triggerasyncid).


#### constant `RequestID.DEFAULT_HEADER_NAME`: string

Returns a default header name used if `headerName` is not specified in middleware options.
