import { Ajv } from 'ajv';
import * as _get from 'lodash.get';
import { OpenAPIV3 } from '../../types';
import { date, dateTime } from '../serializers';
import { SchemaObject, SchemaObjectNode } from '../tree.types';
import { SpecPreprocessorOpts } from './schema.preprocess';
import { TraversalState, TraversalStates } from './schema.walker';

type Schema = OpenAPIV3.ReferenceObject | SchemaObject;

export class SchemaPreprocessorVisitor {
  private readonly ajv: Ajv;
  private readonly opts: SpecPreprocessorOpts;
  constructor(ajv: Ajv, opts: SpecPreprocessorOpts) {
    this.ajv = ajv;
    this.opts = opts;
  }

  visitor(
    parent: SchemaObjectNode,
    node: SchemaObjectNode,
    opts: TraversalStates,
  ) {
    const pschemas = [parent?.schema];
    const nschemas = [node.schema];

    if (this.opts.resSchema) {
      const p = _get(this.opts.resSchema, parent?.path);
      const n = _get(this.opts.resSchema, node?.path);
      pschemas.push(p);
      nschemas.push(n);
    }

    // visit the node in both the request and response schema
    for (let i = 0; i < nschemas.length; i++) {
      const kind = i === 0 ? 'req' : 'res';
      const pschema = pschemas[i];
      const nschema = nschemas[i];
      const options = opts[kind];
      options.path = node.path;

      if (nschema) {
        this.handleSerDes(pschema, nschema, options);
        this.handleReadonly(pschema, nschema, options);
        this.processDiscriminator(pschema, nschema, options);
      }
    }
  }

  private processDiscriminator(parent: Schema, schema: Schema, opts: any = {}) {
    const o = opts.discriminator;
    const schemaObj = <SchemaObject>schema;
    const xOf = schemaObj.oneOf ? 'oneOf' : schemaObj.anyOf ? 'anyOf' : null;

    if (xOf && schemaObj?.discriminator?.propertyName && !o.discriminator) {
      const options = schemaObj[xOf].flatMap((refObject) => {
        if (refObject['$ref'] === undefined) {
          return [];
        }
        const keys = this.findKeys(
          schemaObj.discriminator.mapping,
          (value) => value === refObject['$ref'],
        );
        const ref = this.getKeyFromRef(refObject['$ref']);
        return keys.length > 0
          ? keys.map((option) => ({ option, ref }))
          : [{ option: ref, ref }];
      });
      o.options = options;
      o.discriminator = schemaObj.discriminator?.propertyName;
      o.properties = {
        ...(o.properties ?? {}),
        ...(schemaObj.properties ?? {}),
      };
      o.required = Array.from(
        new Set((o.required ?? []).concat(schemaObj.required ?? [])),
      );
    }

    if (xOf) return;

    if (o.discriminator) {
      o.properties = {
        ...(o.properties ?? {}),
        ...(schemaObj.properties ?? {}),
      };
      o.required = Array.from(
        new Set((o.required ?? []).concat(schemaObj.required ?? [])),
      );

      const ancestor: any = parent;
      const ref = opts.originalSchema.$ref;

      if (!ref) return;

      const options = this.findKeys(
        ancestor.discriminator?.mapping,
        (value) => value === ref,
      );
      const refName = this.getKeyFromRef(ref);
      if (options.length === 0 && ref) {
        options.push(refName);
      }

      if (options.length > 0) {
        const newSchema = JSON.parse(JSON.stringify(schemaObj));
        newSchema.properties = {
          ...(o.properties ?? {}),
          ...(newSchema.properties ?? {}),
        };
        newSchema.required = o.required;
        if (newSchema.required.length === 0) {
          delete newSchema.required;
        }

        ancestor._discriminator ??= {
          validators: {},
          options: o.options,
          property: o.discriminator,
        };

        for (const option of options) {
          ancestor._discriminator.validators[option] = this.ajv.compile(
            newSchema,
          );
        }
      }
      //reset data
      o.properties = {};
      delete o.required;
    }
  }

  private handleSerDes(
    parent: SchemaObject,
    schema: SchemaObject,
    state: TraversalState,
  ) {
    if (state.kind === 'res') {
      if (schema.type === 'string' && !!schema.format) {
        switch (schema.format) {
          case 'date-time':
            (<any>schema).type = ['object', 'string'];
            schema['x-eov-serializer'] = dateTime;
            break;
          case 'date':
            (<any>schema).type = ['object', 'string'];
            schema['x-eov-serializer'] = date;
            break;
        }
      }
    }
  }

  private handleReadonly(
    parent: OpenAPIV3.SchemaObject,
    schema: OpenAPIV3.SchemaObject,
    opts,
  ) {
    if (opts.kind === 'res') return;

    const required = parent?.required ?? [];
    const prop = opts?.path?.[opts?.path?.length - 1];
    const index = required.indexOf(prop);
    if (schema.readOnly && index > -1) {
      // remove required if readOnly
      parent.required = required
        .slice(0, index)
        .concat(required.slice(index + 1));
      if (parent.required.length === 0) {
        delete parent.required;
      }
    }
  }

  private findKeys(object, searchFunc): string[] {
    const matches = [];
    if (!object) {
      return matches;
    }
    const keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      if (searchFunc(object[keys[i]])) {
        matches.push(keys[i]);
      }
    }
    return matches;
  }

  private getKeyFromRef(ref) {
    return ref.split('/components/schemas/')[1];
  }
}
