import * as asyncHooks from 'async_hooks';
import { v4 as uuid } from 'uuid';

export namespace RequestID {
  export interface Storage {
    requestId: string;
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

  export const DEFAULT_HEADER_NAME = 'x-request-id';
  export const asyncMap = new Map<number, Storage>();

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

  /**
   *
   * @returns {string | undefined}
   */
  export function getRequestId(): string | undefined {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      return;
    }

    return storage.requestId;
  }

  /**
   *
   * @param {RequestID.Options} options
   * @returns {Middleware}
   */
  export function middleware(options: Options = {}): Middleware {
    return async (ctx: Context, next: Function) => {
      const id = asyncHooks.executionAsyncId();
      const requestId = getOrCreateRequestId(ctx, options);

      asyncMap.set(id, { requestId });
      ctx.set(getHeaderName(options), requestId);

      return next();
    };
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
  function getOrCreateRequestId(ctx: Context, options: Options): string {
    const headerName = getHeaderName(options);

    if (ctx.headers[headerName]) {
      return ctx.headers[headerName];
    }

    if (options.prefix) {
      return `${options.prefix}-${uuid()}`;
    }

    return uuid();
  }

}
