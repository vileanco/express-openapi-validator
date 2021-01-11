import { Node, Root, SchemaObject } from '../tree.types';
import { schemaResolver } from './schema.util';
import { SpecPreprocessorOpts } from './schema.preprocess';
import { OpenAPIV3 } from '../../types';
import { Ajv } from 'ajv';
import { pathToRegexp } from 'path-to-regexp';

export interface TraversalStates {
  req: TraversalState;
  res: TraversalState;
}

export interface TraversalState {
  discriminator: object;
  kind: 'req' | 'res';
  path: string[];
  originalSchema?: SchemaObject;
}

export class SchemaWalker {
  private readonly opts: SpecPreprocessorOpts;
  private readonly resolveSchema: <T>(
    schema: T | OpenAPIV3.ReferenceObject,
  ) => T;
  constructor(ajv: Ajv, opts: SpecPreprocessorOpts) {
    this.opts = opts;
    this.resolveSchema = schemaResolver(ajv, opts);
  }
  /**
   * Traverse the schema starting at each node in nodes
   * @param roots the nodes to traverse
   * @param visit a function to invoke per node
   */
  public walk(roots: Root<SchemaObject>[], visit) {
    const seen = new Set();
    const recurse = (parent, node, opts: TraversalStates) => {
      if (seen.has(node.schema)) return;

      if (node.schema.$ref) {
        const schema = this.resolveSchema<SchemaObject>(node.schema);
        const path = node.schema.$ref.split('/').slice(1);
        const child = new Node(node.schema, schema, path);
        recurse(parent, child, opts);

        return seen.add(node.schema);
      }
      const schema = node.schema;
      // const schema = this.resolveSchema<SchemaObject>(node.schema);
      seen.add(node.schema);
      // TODO remove this
      // Save the original schema so we can check if it was a $ref
      opts.req.originalSchema = node.schema;
      opts.res.originalSchema = node.schema;

      visit(parent, node, opts);

      if (schema.allOf) {
        schema.allOf.forEach((s, i) => {
          const child = new Node(node, s, [...node.path, 'allOf', i + '']);
          recurse(node, child, opts);
        });
      } else if (schema.oneOf) {
        schema.oneOf.forEach((s, i) => {
          const child = new Node(node, s, [...node.path, 'oneOf', i + '']);
          recurse(node, child, opts);
        });
      } else if (schema.anyOf) {
        schema.anyOf.forEach((s, i) => {
          const child = new Node(node, s, [...node.path, 'anyOf', i + '']);
          recurse(node, child, opts);
        });
      } else if (node.schema.properties) {
        Object.entries(node.schema.properties).forEach(([id, cschema]) => {
          const path = [...node.path, 'properties', id];
          const child = new Node(node, cschema, path);
          recurse(node, child, opts);
        });
      }
    };

    const initOpts = (): TraversalStates => ({
      req: { discriminator: {}, kind: 'req', path: [] },
      res: { discriminator: {}, kind: 'res', path: [] },
    });

    for (const node of roots) {
      recurse(null, node, initOpts());
    }
  }
}
