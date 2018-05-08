import * as asyncHooks from 'async_hooks';
import { v4 as uuid } from 'uuid';

export namespace RequestID {
  export const DEFAULT_HEADER_NAME = 'x-request-id';
  const storage = new Map<number, string>();

  export interface Options {
    prefix?: string;
    headerName?: string;
  }

  export interface Context {
    headers: any;
    set: (key: string, value: string) => void;
  }

  export type Middleware = (context: any, next: () => Promise<any>) => any;

  /**
   *
   * @returns {string | undefined}
   */
  export function getRequestId(): string | undefined {
    return storage.get(asyncHooks.triggerAsyncId());
  }

  /**
   *
   * @param {RequestID.Options} options
   * @returns {Middleware}
   */
  export function middleware(options: Options = {}): Middleware {
    return async (ctx: Context, next: Function) => {
      const id = asyncHooks.triggerAsyncId();
      const requestId = getOrCreateRequestId(ctx, options);

      storage.set(id, requestId);

      return next().finally(() => {
        ctx.set(getHeaderName(options), requestId);
        storage.delete(id);
      });
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
