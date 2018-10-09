import * as asyncHooks from 'async_hooks';
import { v4 as uuid } from 'uuid';

export namespace RequestID {
  export interface Storage {
    requestId: string;
    data: any;
  }

  export interface Options {
    prefix?: string;
    headerName?: string;
  }

  export interface Context {
    headers: any;
    set: (key: string, value: string) => void;
  }

  export type Middleware = (context: any, next: () => Promise<any>) => any;

  // - init asyncHooks only if it's not already initialised
  const shouldInitAsyncHooks = !(<any>global).__requestIDMap;
  export const DEFAULT_HEADER_NAME = 'x-request-id';

  // - store Map globally across all instances of RequestID
  export const asyncMap: Map<number, Storage> = (<any>global).__requestIDMap =
    (<any>global).__requestIDMap || new Map<number, Storage>();

  if (shouldInitAsyncHooks) {
    asyncHooks
      .createHook({
        init: (asyncId, _, triggerAsyncId) => {
          if (asyncMap.has(triggerAsyncId)) {
            asyncMap.set(asyncId, <any>asyncMap.get(triggerAsyncId));
          }
        },
        destroy(asyncId) {
          asyncMap.delete(asyncId);
        },
      })
      .enable();
  }

  /**
   *
   * @returns {string | undefined}
   */
  export function getAsyncContextId(): string | undefined {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      return;
    }

    return storage.requestId;
  }

  /**
   *
   * @param {string} key
   * @param value
   */
  export function setData(key: string, value: any) {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      console.warn(new Error('no async context id is available').stack);

      return;
    }

    storage.data[key] = value;
  }

  /**
   *
   * @param {string} key
   * @returns {any}
   */
  export function getData(key?: string) {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      console.warn(new Error('no async context id is available').stack);

      return;
    }

    if (key) {
      if (!storage.data) {
        return;
      }

      return storage.data[key];
    }

    return storage.data;
  }

  /**
   *
   * @param {RequestID.Options} options
   * @returns {Middleware}
   */
  export function middleware(options: Options = {}): Middleware {
    return async (ctx: Context, next: Function) => {
      const id = asyncHooks.executionAsyncId();
      const asyncContextId = getRequestIdFromHeadersOrCreate(ctx, options);

      asyncMap.set(id, { requestId: asyncContextId, data: {} });
      ctx.set(getHeaderName(options), asyncContextId);

      return next();
    };
  }

  /**
   *
   * @param {string} prefix
   * @returns {string}
   */
  export function getOrCreateAsyncContextId(prefix?: string) {
    const existingContextId = getAsyncContextId();

    if (existingContextId) {
      return existingContextId;
    }

    const newAsyncContextId = createUUID(prefix);
    asyncMap.set(asyncHooks.executionAsyncId(), { requestId: newAsyncContextId, data: {} });

    return newAsyncContextId;
  }

  /**
   *
   * @param prefix
   */
  export function createUUID(prefix?: string): string {
    if (prefix) {
      return `${prefix}-${uuid()}`;
    }

    return uuid();
  }

  /**
   *
   * @param {RequestID.Options} options
   * @returns {string}
   */
  function getHeaderName(options: Options): string {
    return options.headerName || DEFAULT_HEADER_NAME;
  }

  /**
   *
   * @param {Context} ctx
   * @param {RequestID.Options} options
   * @returns {string}
   */
  function getRequestIdFromHeadersOrCreate(ctx: Context, options: Options): string {
    const headerName = getHeaderName(options);

    if (ctx.headers[headerName]) {
      return ctx.headers[headerName];
    }

    return createUUID(options.prefix);
  }

}
