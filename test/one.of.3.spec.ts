import * as path from 'path';
import { expect } from 'chai';
import * as request from 'supertest';
import { createApp } from './common/app';
import * as packageJson from '../package.json';

describe('oneOf 3', () => {
  let app = null;

  before(async () => {
    const apiSpec = path.join('test', 'resources', 'one.of.3.yaml');
    app = await createApp(
      {
        apiSpec,
        validateApiSpec: true,
        validateRequests: true,
        validateResponses: { removeAdditional: 'failing' },
      },
      3005,
      (app) => {
        app.post(`${app.basePath}/one_of`, (req, res) => {
          res.json(req.body);
        });
        app.post(`${app.basePath}/one_of_b`, (req, res) => {
          res.json(req.body);
        });
        app.use((err, req, res, next) => {
          res.status(err.status ?? 500).json({
            message: err.message,
            code: err.status ?? 500,
          });
        });
      },
      false,
    );
  });

  after(() => {
    app.server.close();
  });

  it('should return 200 one first oneOf option', async () => {
    return request(app)
      .post(`${app.basePath}/one_of`)
      .set('content-type', 'application/json')
      .send({
        id: 'some_id',
        type: 'A',
      })
      .expect(200);
  });

  it('should return 200 one second oneOf option', async () => {
    return request(app)
      .post(`${app.basePath}/one_of`)
      .set('content-type', 'application/json')
      .send({
        id: 'some_id',
        type: 'B',
        extra: 'something',
      })
      .expect(200);
  });
});
