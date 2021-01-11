import { Ajv } from 'ajv';
import * as _get from 'lodash.get';
import { OpenAPIV3 } from '../../types';
import { SpecPreprocessorOpts } from './schema.preprocess';

export function schemaResolver<T>(ajv: Ajv, opts: SpecPreprocessorOpts) {
  return (schema: T | OpenAPIV3.ReferenceObject): T => {
    if (!schema) return null;
    const ref = schema?.['$ref'];
    const reqSchema = ref ? opts.reqRefParser.$refs.get(ref) : schema;
    // let res = (ref ? ajv.getSchema(ref)?.schema : schema) as T;
    // if (ref && !res) {
    //   const path = ref.split('/').join('.');
    //   const p = path.substring(path.indexOf('.') + 1);
    //   res = _get(opts.reqSchema, p);
    // }
    return reqSchema;
  };
}
