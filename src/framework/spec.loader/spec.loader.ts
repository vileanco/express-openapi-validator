import * as $RefParser from 'json-schema-ref-parser';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV3 } from '../types';

export interface SpecLoaderResponse {
  reqSchema: OpenAPIV3.Document;
  reqRefParser: $RefParser;
  resSchema: OpenAPIV3.Document;
  resRefParser: $RefParser;
}

export interface SpecLoaderOpts {
  filePath: string | object; // TODO should be OpenAPIV3.Document;
  $refParserOpts: { mode: 'bundle' | 'dereference' };
  useDedicatedResponseDoc: boolean;
}

export class SpecLoader {
  private opts: SpecLoaderOpts;
  constructor(opts: SpecLoaderOpts) {
    this.opts = opts;
  }
  public async load(): Promise<SpecLoaderResponse> {
    const reqRefParser = new $RefParser();
    const resRefParser = new $RefParser();
    const parses = [this.loadApiDoc(reqRefParser)];
    if (this.opts.useDedicatedResponseDoc) {
      parses.push(this.loadApiDoc(resRefParser));
    }
    const [reqSchema, resSchema] = await Promise.all(parses);
    return {
      reqSchema,
      resSchema,
      reqRefParser,
      resRefParser,
    };
  }

  private loadApiDoc(refParser: $RefParser): Promise<$RefParser.JSONSchema> {
    const { filePath, $refParserOpts } = this.opts;
    if (typeof filePath === 'string') {
      const origCwd = process.cwd();
      const specDir = path.resolve(origCwd, path.dirname(filePath));
      const absolutePath = path.resolve(origCwd, filePath);
      if (fs.existsSync(absolutePath)) {
        // Get document, or throw exception on error
        try {
          process.chdir(specDir);
          return $refParserOpts.mode === 'dereference'
            ? refParser.dereference(absolutePath)
            : refParser.bundle(absolutePath);
        } finally {
          process.chdir(origCwd);
        }
      } else {
        throw new Error(`spec could not be read at ${filePath}`);
      }
    }
    return $refParserOpts.mode === 'dereference'
      ? refParser.dereference(filePath)
      : refParser.bundle(filePath);
  }
}
