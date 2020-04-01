import * as path from 'path';
import { expect } from 'chai';
import * as request from 'supertest';
import { createApp } from './common/app';
import * as packageJson from '../package.json';

const apiSpecPath = path.join('test', 'resources', 'response.all.of.yaml');
const today = new Date();

describe.skip(packageJson.name, () => {
  let app = null;

  before(async () => {
    // set up express app
    app = await createApp(
      {
        apiSpec: apiSpecPath,
        validateResponses: true,
      },
      3005,
      app => {
        console.log(`${app.basePath}/all_of_1`);
        app.get(`${app.basePath}/all_of_1?`, (req, res) => {
          const mode = req.query.mode;
          let r: any = { property1: 1 };
          if (mode == 'all') {
            r = { property1: 1, property2: 'some_string' };
          } else if (mode == 'type_2') {
            r = { property2: 'some_string' };
          } else {
            r = { property1: 1 };
          }
          res.json(r);
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

  it('should pass if the response includes all allOf types', async () =>
    request(app)
      .get(`${app.basePath}/all_of_1`)
      .query({
        mode: 'all',
      })
      // .expect(200)
      .then(r => {
        console.log(r.body);
      }));

  it('should fail if missing properties of an allOf type', async () =>
    request(app)
      .get(`${app.basePath}/all_of_1`)
      .query({
        mode: 'type_1',
      })
      .expect(500)
      .then((r: any) => {
        expect(r.body)
          .to.have.property('message')
          .that.not.contains('additional properties');
        expect(r.body)
          .to.have.property('code')
          .that.equals(500);
      }));
});
