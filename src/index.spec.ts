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
      expect(item).to.equals(id, `index ${index}`);
    });
  }

  it('should return undefined if middleware was not called', async () => {
    expect(RequestID.getRequestId()).to.equals(undefined);
  });
  it('should return same request id in the same async stack trace', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = RequestID.getRequestId();
        const id2 = await remoteCall();

        ctx.body = [id1, id2];
      })
      .callback();

    async function remoteCall() {
      return RequestID.getRequestId();
    }

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getRequestId()).to.equals(undefined);
        assertRequestIds(body);
      });
  });
  it('should return same request id even after async function call', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = await remoteCall();
        const id2 = RequestID.getRequestId();

        ctx.body = [id1, id2];
      })
      .callback();

    async function remoteCall() {
      return RequestID.getRequestId();
    }

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getRequestId()).to.equals(undefined);
        assertRequestIds(body);
      });
  });
  it('should return same request id even in setTimeout', async () => {
    const api = new Application()
      .use(RequestID.middleware())
      .use(async (ctx) => {
        const id1 = RequestID.getRequestId();
        const id2 = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(RequestID.getRequestId());
          }, 10);
        });

        ctx.body = [id1, id2];
      })
      .callback();

    await supertest(api)
      .get('/')
      .expect(200)
      .then(({ body }) => {
        expect(RequestID.getRequestId()).to.equals(undefined);
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
  it('should set custom header header', async () => {
    const api = new Application()
      .use(RequestID.middleware({
        headerName: 'custom-name',
      }))
      .use(async (ctx) => {
        ctx.body = null;
      })
      .callback();

    await supertest(api)
      .get('/')
      .expect(204)
      .then((response) => {
        expect(response.header).to.contain.keys(['custom-name']);
        expect(response.header['custom-name']).to.be.a('string');
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
});
