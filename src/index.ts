import * as asyncHooks from 'async_hooks';
import { v4 as uuid } from 'uuid';

export namespace RequestID {
  export interface Metadata {
    hop: number;
    session?: string;
    sessionGroup?: string;
  }

  export interface Storage<T> extends Metadata {
    requestId: string;
    data: T;
  }

  export interface Options {
    prefix?: string;
  }

  export interface Context {
    headers: any;
    set: (key: string, value: string) => void;
  }

  export type Middleware = (context: any, next: () => Promise<any>) => any;

  // - init asyncHooks only if it's not already initialised
  const shouldInitAsyncHooks = !(<any>global).__requestIDMap;
  export const REQUEST_ID_HEADER_NAME = 'x-request-id';
  export const REQUEST_HOP_HEADER_NAME = 'x-request-hop';
  export const REQUEST_SESSION_ID_HEADER_NAME = 'x-request-session-id';
  export const REQUEST_SESSION_GROUP_ID_HEADER_NAME = 'x-request-session-group-id';

  // - store Map globally across all instances of RequestID
  export const asyncMap: Map<number, Storage<any>> = (<any>global).__requestIDMap =
    (<any>global).__requestIDMap || new Map<number, Storage<any>>();

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
  export function setData<T>(key: string, value: T) {
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
  export function getData<T>(key?: string): T | undefined {
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
      const hop = Number(ctx.headers[REQUEST_HOP_HEADER_NAME]) || 0;

      asyncMap.set(id, {
        requestId: asyncContextId,
        hop,
        session: ctx.headers[REQUEST_SESSION_ID_HEADER_NAME],
        sessionGroup: ctx.headers[REQUEST_SESSION_GROUP_ID_HEADER_NAME],
        data: {},
      });

      ctx.set(REQUEST_ID_HEADER_NAME, asyncContextId);
      ctx.set(REQUEST_HOP_HEADER_NAME, hop.toString());
      ctx.set(REQUEST_SESSION_GROUP_ID_HEADER_NAME, ctx.headers[REQUEST_SESSION_GROUP_ID_HEADER_NAME]);
      ctx.set(REQUEST_SESSION_ID_HEADER_NAME, ctx.headers[REQUEST_SESSION_ID_HEADER_NAME]);

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
    asyncMap.set(asyncHooks.executionAsyncId(), {
      requestId: newAsyncContextId,
      hop: 0,
      data: {},
    });

    return newAsyncContextId;
  }

  /**
   *
   * @returns {number}
   */
  export function getHop(): number {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      return -1;
    }

    return storage.hop;
  }

  /**
   *
   * @returns {RequestID.Metadata | null}
   */
  export function getMetadata(): Metadata | null {
    const storage = asyncMap.get(asyncHooks.executionAsyncId());

    if (!storage) {
      return null;
    }

    return {
      hop: storage.hop,
      session: storage.session,
      sessionGroup: storage.sessionGroup,
    };
  }

  /**
   *
   * @param prefix
   */
  export function createUUID(prefix?: string): string {
    if (prefix) {
      return `${ prefix }-${ uuid() }`;
    }

    return uuid();
  }

  /**
   *
   * @param {Context} ctx
   * @param {RequestID.Options} options
   * @returns {string}
   */
  function getRequestIdFromHeadersOrCreate(ctx: Context, options: Options): string {
    if (ctx.headers[REQUEST_ID_HEADER_NAME]) {
      return ctx.headers[REQUEST_ID_HEADER_NAME];
    }

    return createUUID(options.prefix);
  }

}
