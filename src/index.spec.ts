import { expect } from 'chai';
import { RequestID } from './index';
import Application = require('koa');
import sinon = require('sinon');
import supertest = require('supertest');

describe('request-id', () => {
  const sandbox = sinon.sandbox.create();

  afterEach(async () => {
    sandbox.restore();
  });

  function assertRequestIds(ids: string[]) {
    expect(ids.length).to.gt(1);
    expect(ids[0]).to.be.a('string');

    const [id, ...rest] = ids;

    rest.forEach((item, index) => {
      expect(item).to.equals(id, `index ${ index }`);
    });
  }

  it('should return undefined if middleware was not called', async () => {
    expect(RequestID.getAsyncContextId()).to.equals(undefined);
  });
  it('should return same request id in the same async stack trace', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = RequestID.getAsyncContextId();
        const id2 = await remoteCall();

        ctx.body = [id1, id2];
      })
      .callback();

    async function remoteCall() {
      return RequestID.getAsyncContextId();
    }

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getAsyncContextId()).to.equals(undefined);
        assertRequestIds(body);
      });
  });
  it('should return same request id even after async function call', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = await remoteCall();
        const id2 = RequestID.getAsyncContextId();

        ctx.body = [id1, id2];
      })
      .callback();

    async function remoteCall() {
      return RequestID.getAsyncContextId();
    }

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getAsyncContextId()).to.equals(undefined);
        assertRequestIds(body);
      });
  });
  it('should return same request id even in setTimeout', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = RequestID.getAsyncContextId();
        const id2 = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(RequestID.getAsyncContextId());
          }, 10);
        });

        ctx.body = [id1, id2];
      })
      .callback();

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getAsyncContextId()).to.equals(undefined);
        assertRequestIds(body);
      });
  });
  it('should set request-id header', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .expect(204)
      .then((response) => {
        expect(response.header).to.contain.keys(['x-request-id']);
        expect(response.header['x-request-id']).to.be.a('string');
      });
  });
  it('should keep passed request-id', async () => {
    const api = new Application()
      .use(RequestID.middleware({}))
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .set('X-Request-ID', 'value')
      .expect(204)
      .then((response) => {
        expect(response.header['x-request-id']).to.be.equals('value');
      });
  });
  it('should set hop header', async () => {
    const api = new Application()
      .use(RequestID.middleware({}))
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .set('X-Request-ID', 'value')
      .expect(204)
      .then((response) => {
        expect(response.header['x-request-hop']).to.be.equals('0');
      });
  });
  it('should increate hop number', async () => {
    const api = new Application()
      .use(RequestID.middleware({}))
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .set('X-Request-ID', 'value')
      .set('X-Request-hop', '1')
      .expect(204)
      .then((response) => {
        expect(response.header['x-request-hop']).to.be.equals('1');
      });
  });
  it('should prefix request-id header', async () => {
    const api = new Application()
      .use(RequestID.middleware({
        prefix: 'test',
      }))
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .expect(204)
      .then((response) => {
        expect(response.header['x-request-id']).to.match(/^test-/);
      });
  });
  it('should create context within a function', async () => {
    const fn2 = async () => {
      return new Promise((resolve) => {
        setImmediate(() => {
          process.nextTick(() => {
            resolve(RequestID.getAsyncContextId());
          });
        });
      });
    };

    const run = async () => {
      const one = RequestID.getOrCreateAsyncContextId('test');

      const two = await fn2();

      const three = RequestID.getAsyncContextId();

      return [one, two, three];
    };

    const result: any = await new Promise((resolve, reject) => {
      setTimeout(() => {
        run().then(resolve, reject);
      }, 0);
    });

    result.reduce((a: any, b: any) => {
      expect(a).to.equals(b);

      return a;
    });
  });

  describe('.requestId()', async () => {
    it('should allow to create request-id manually', async () => {
      const r = RequestID.getOrCreateAsyncContextId();

      expect(r).to.be.a('string');
    });
    it('should return the same request-id when calling getRequestId()', async () => {
      const r1 = RequestID.getOrCreateAsyncContextId();
      const r2 = RequestID.getAsyncContextId();

      expect(r1).to.be.equals(r2);
    });
    it('should return the same request-id when calling RequestID.initRequestId twice', async () => {
      const r1 = RequestID.getOrCreateAsyncContextId();
      const r2 = RequestID.getOrCreateAsyncContextId();

      expect(r1).to.be.a('string');
      expect(r1).to.equals(r2);
    });
    it('should generate different request ids in separate contexts', async () => {
      const r1 = await new Promise((resolve) => {
        resolve(RequestID.getOrCreateAsyncContextId());
      });
      const r2 = await new Promise((resolve) => {
        resolve(RequestID.getOrCreateAsyncContextId());
      });

      expect(r1).to.be.a('string');
      expect(r1).not.to.equals(r2);
    });
  });

  describe('storage data', async () => {
    it('should warn if async context id is not created', async () => {
      const warn = sinon.stub(console, 'warn');
      RequestID.setData('one', 'two');

      expect(warn.callCount).to.equals(1);
    });
    it('should set value', async () => {
      RequestID.getOrCreateAsyncContextId();
      RequestID.setData('one', 'two');
    });
    it('should get value', async () => {
      RequestID.getOrCreateAsyncContextId();
      RequestID.setData('one', 'two');

      expect(RequestID.getData('one')).to.equals('two');
    });
    it('should get whole value', async () => {
      RequestID.getOrCreateAsyncContextId();
      RequestID.setData('one', 'two');

      expect(RequestID.getData()).to.deep.equals({
        one: 'two',
      });
    });
    it('should default to an empty object', async () => {
      RequestID.getOrCreateAsyncContextId();

      expect(RequestID.getData()).to.deep.equals({});
    });
  });
});
