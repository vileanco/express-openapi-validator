import { JSONSchema } from 'json-schema-ref-parser';
import { createRequestAjv } from '../../ajv';
import { SchemaCollector } from './schema.collector';
import { SchemaPreprocessorVisitor } from './schema.preprocessor.visitor';
import { SchemaWalker } from './schema.walker';
import $RefParser = require('json-schema-ref-parser');
import ajv = require('ajv');

export interface SpecPreprocessorResponse {
  reqSchema: JSONSchema,
  resSchema?: JSONSchema,
}
export interface SpecPreprocessorOpts {
  ajvOpts: ajv.Options;
  reqSchema: JSONSchema;
  reqRefParser: $RefParser;
  resSchema?: JSONSchema;
  resRefParser?: $RefParser;
}

export class SpecPreprocessor {
  private readonly opts: SpecPreprocessorOpts;
  private ajv: ajv.Ajv;
  private schemaCollector: SchemaCollector;
  constructor(opts: SpecPreprocessorOpts) {
    this.opts = opts;
    this.ajv = createRequestAjv(opts.reqSchema, opts.ajvOpts);
    this.schemaCollector = new SchemaCollector(this.ajv, opts);
  }

  public async preprocess(): Promise<SpecPreprocessorResponse> {
    const cs = this.schemaCollector.collect();
    const schemas = [
      ...cs.componentSchemas,
      ...cs.requestBodies,
      ...cs.responses,
    ];

    new SchemaWalker(this.ajv, this.opts).walk(
      schemas,
      (parent, schema, opts) =>
        new SchemaPreprocessorVisitor(this.ajv, this.opts).visitor(
          parent,
          schema,
          opts,
        ),
    );

    return {
      reqSchema: this.opts.reqSchema,
      resSchema: this.opts.resSchema,
    };
  }
}
