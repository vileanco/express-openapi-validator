const Ajv = require('ajv');
const draftSchema = require('ajv/lib/refs/json-schema-draft-04.json');
var ajv = new Ajv({
  nullable: true,
  coerceTypes: true,
  removeAdditional: false,
  useDefaults: true,
  unknownFormats: undefined,
  allowUnknownQueryParameters: false,
  schemaId: 'auto',
  allErrors: true,
  meta: draftSchema,
});
// require('ajv-async')(ajv);

// ajv.addKeyword('idExists', {
//   async: true,
//   type: 'number',
//   validate: checkIdExists
// });

// function checkIdExists(schema, data) {
//   return knex(schema.table)
//   .select('id')
//   .where('id', data)
//   .then(function (rows) {
//     return !!rows.length; // true if record is found
//   });
// }

var petSchemaArray = {
  // required:
  //   - name
  $async: true,
  response: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        bought_at: {
          type: 'string',
          format: 'date-time',
          nullable: true,
        },
        name: {
          type: 'string',
          nullable: true,
        },
        tag: {
          type: 'string',
        },
      },
    },
  },
};
var petSchemObject = {
  // required:
  //   - name
  $async: true,
  type: 'object',
  properties: {
    bought_at: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    name: {
      type: 'string',
      nullable: true,
    },
    tag: {
      type: 'string',
    },
  },
};
var schema = {
  //   $async: true,
  properties: {
    userId: {
      type: 'integer',
      //   "idExists": { "table": "users" }
    },
    postId: {
      type: 'integer',
      //   "idExists": { "table": "posts" }
    },
  },
};

var validate = ajv.compile(petSchemObject);
console.log(validate);
validate([{ id: 1, name: 'name', tag: 'tag', bought_at: '' }])
  .then(function(data) {
    console.log('Data is valid', data); // { userId: 1, postId: 19 }
  })
  .catch(function(err) {
    if (!(err instanceof Ajv.ValidationError)) throw err;
    // data is invalid
    console.log('Validation errors:', err.errors);
  });

// var validate = ajv.compile(schema);

// validate({ userId: 1, postId: 19 })
//   .then(function(data) {
//     console.log('Data is valid', data); // { userId: 1, postId: 19 }
//   })
//   .catch(function(err) {
//     if (!(err instanceof Ajv.ValidationError)) throw err;
//     // data is invalid
//     console.log('Validation errors:', err.errors);
//   });
