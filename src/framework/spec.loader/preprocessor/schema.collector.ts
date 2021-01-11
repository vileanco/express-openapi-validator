import { Node, Root, SchemaObject, SchemaObjectNode } from '../tree.types';
import { OpenAPIV3 } from '../../types';
import { schemaResolver } from './schema.util';
import { Ajv } from 'ajv';
import { SpecPreprocessorOpts } from './schema.preprocess';

interface TopLevelPathNodes {
  requestBodies: Root<SchemaObject>[];
  responses: Root<SchemaObject>[];
}

const httpMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

export interface CollectedSchemas {
  componentSchemas: Root<SchemaObject>[];
  requestBodies: Root<SchemaObject>[];
  responses: Root<SchemaObject>[];
}

export class SchemaCollector {
  private readonly ajv: Ajv;
  private readonly opts: SpecPreprocessorOpts;
  private readonly resolveSchema: <T>(
    schema: T | OpenAPIV3.ReferenceObject,
  ) => T;
  constructor(ajv: Ajv, opts: SpecPreprocessorOpts) {
    this.ajv = ajv;
    this.opts = opts;
    this.resolveSchema = schemaResolver(ajv, this.opts);
  }

  collect(): CollectedSchemas {
    const componentSchemas = this.gatherComponentSchemaNodes();
    const { requestBodies, responses } = this.gatherSchemaNodesFromPaths();

    return {
      componentSchemas,
      requestBodies,
      responses,
    };
  }

  gatherComponentSchemaNodes(): Root<SchemaObject>[] {
    const nodes = [];
    const apiDoc: OpenAPIV3.Document = this.opts.reqSchema;
    const componentSchemaMap = apiDoc?.components?.schemas ?? [];
    for (const [id, s] of Object.entries(componentSchemaMap)) {
      const schema = this.resolveSchema<SchemaObject>(s);
      this.opts.reqSchema.components.schemas[id] = schema;
      const path = ['components', 'schemas', id];
      const node = new Root(schema, path);
      nodes.push(node);
    }
    return nodes;
  }

  gatherSchemaNodesFromPaths(): TopLevelPathNodes {
    const requestBodySchemas = [];
    const responseSchemas = [];

    for (const [p, pi] of Object.entries(this.opts.reqSchema.paths)) {
      const pathItem = this.resolveSchema<OpenAPIV3.PathItemObject>(pi);
      for (const method of Object.keys(pathItem)) {
        if (httpMethods.has(method)) {
          const operation = <OpenAPIV3.OperationObject>pathItem[method];
          // Adds path declared parameters to the schema's parameters list
          this.preprocessPathLevelParameters(method, pathItem);
          const path = ['paths', p, method];
          const node = new Root<OpenAPIV3.OperationObject>(operation, path);
          const requestBodies = this.extractRequestBodySchemaNodes(node);
          const responseBodies = this.extractResponseSchemaNodes(node);

          requestBodySchemas.push(...requestBodies);
          responseSchemas.push(...responseBodies);
        }
      }
    }
    return {
      requestBodies: requestBodySchemas,
      responses: responseSchemas,
    };
  }

  /**
   * extract all requestBodies' schemas from an operation
   * @param op
   */
  extractRequestBodySchemaNodes(
    node: Root<OpenAPIV3.OperationObject>,
  ): Root<SchemaObject>[] {
    const op = node.schema;
    const bodySchema = this.resolveSchema<OpenAPIV3.RequestBodyObject>(
      op.requestBody,
    );
    op.requestBody = bodySchema;

    if (!bodySchema?.content) return [];

    const result: Root<SchemaObject>[] = [];
    const contentEntries = Object.entries(bodySchema.content);
    for (const [type, mediaTypeObject] of contentEntries) {
      const mediaTypeSchema = this.resolveSchema<SchemaObject>(
        mediaTypeObject.schema,
      );
      op.requestBody.content[type].schema = mediaTypeSchema;
      const path = [...node.path, 'requestBody', 'content', type, 'schema'];
      result.push(new Root(mediaTypeSchema, path));
    }
    return result;
  }

  extractResponseSchemaNodes(
    node: Root<OpenAPIV3.OperationObject>,
  ): Root<SchemaObject>[] {
    const op = node.schema;
    const responses = op.responses;

    if (!responses) return;

    const schemas: Root<SchemaObject>[] = [];
    for (const [statusCode, response] of Object.entries(responses)) {
      const rschema = this.resolveSchema<OpenAPIV3.ResponseObject>(response);
      responses[statusCode] = rschema;

      if (rschema.content) {
        for (const [type, mediaType] of Object.entries(rschema.content)) {
          const schema = this.resolveSchema<SchemaObject>(mediaType?.schema);
          if (schema) {
            rschema.content[type].schema = schema;
            const path = [
              ...node.path,
              'responses',
              statusCode,
              'content',
              type,
              'schema',
            ];
            schemas.push(new Root(schema, path));
          }
        }
      }
    }
    return schemas;
  }

  /**
   * add path level parameters to the schema's parameters list
   * @param pathItemKey
   * @param pathItem
   */
  preprocessPathLevelParameters(
    pathItemKey: string,
    pathItem: OpenAPIV3.PathItemObject,
  ) {
    const parameters = pathItem.parameters ?? [];

    if (parameters.length === 0) return;

    const v = this.resolveSchema<OpenAPIV3.OperationObject>(
      pathItem[pathItemKey],
    );
    if (v === parameters) return;
    v.parameters = v.parameters || [];

    for (const param of parameters) {
      v.parameters.push(param);
    }
  }
}
