import { OpenAPISchemaValidator } from './openapi.schema.validator';
import { BasePath } from './base.path';
import {
  OpenAPIFrameworkArgs,
  OpenAPIFrameworkInit,
  OpenAPIFrameworkVisitor,
  OpenAPIV3,
} from './types';
import {
  SpecPreprocessor,
  SpecPreprocessorResponse,
} from './spec.loader/preprocessor/schema.preprocess';
import { SpecLoader, SpecLoaderResponse } from './spec.loader/spec.loader';

export interface OpenAPISpecs {
  reqSchema: OpenAPIV3.Document;
  resSchema?: OpenAPIV3.Document;
}
export class OpenAPIFramework {
  private readonly args: OpenAPIFrameworkArgs;
  private readonly loggingPrefix: string = 'openapi.validator: ';

  constructor(args: OpenAPIFrameworkArgs) {
    this.args = args;
  }

  public async initialize(
    visitor: OpenAPIFrameworkVisitor,
  ): Promise<OpenAPIFrameworkInit> {
    const args = this.args;
    const lsr = await this.loadSpec(args.apiDoc, args.$refParser);

    const basePathObs = this.getBasePathsFromServers(lsr.reqSchema.servers);
    const basePaths = Array.from(
      basePathObs.reduce((acc, bp) => {
        bp.all().forEach((path) => acc.add(path));
        return acc;
      }, new Set<string>()),
    );
    const validateApiDoc =
      'validateApiDoc' in args ? !!args.validateApiDoc : true;
    const validator = new OpenAPISchemaValidator({
      version: lsr.reqSchema.openapi,
      // extensions: this.apiDoc[`x-${args.name}-schema-extension`],
    });

    if (validateApiDoc) {
      const apiDocValidation = validator.validate(lsr.reqSchema);

      if (apiDocValidation.errors.length) {
        console.error(`${this.loggingPrefix}Validating schema`);
        console.error(
          `${this.loggingPrefix}validation errors`,
          JSON.stringify(apiDocValidation.errors, null, '  '),
        );
        throw new Error(
          `${this.loggingPrefix}args.apiDoc was invalid.  See the output.`,
        );
      }
    }
    const prer = await this.preprocess(lsr);

    const getApiDocs = () => {
      return { apiDoc: prer.reqSchema, apiResponseDoc: prer.resSchema };
    };

    this.sortApiDocTags(prer.reqSchema);

    if (visitor.visitApi) {
      // const basePaths = basePathObs;
      visitor.visitApi({
        basePaths,
        getApiDocs,
      });
    }
    return {
      apiDoc: prer.reqSchema,
      apiResponseDoc: prer.resSchema,
      basePaths,
    };
  }

  private async loadSpec(
    filePath: string | object,
    $refParser: { mode: 'bundle' | 'dereference' } = { mode: 'bundle' },
  ): Promise<SpecLoaderResponse> {
    return new SpecLoader({
      filePath,
      $refParserOpts: $refParser,
      useDedicatedResponseDoc: this.args.useDediateResponseApiDoc,
    }).load();
  }

  private async preprocess(
    slr: SpecLoaderResponse,
  ): Promise<SpecPreprocessorResponse> {
    return new SpecPreprocessor({
      ajvOpts: this.args.ajvOpts,
      reqSchema: slr.reqSchema,
      resSchema: slr.reqSchema,
      reqRefParser: slr.reqRefParser,
      resRefParser: slr.resRefParser,
    }).preprocess();
  }
  private sortApiDocTags(apiDoc: OpenAPIV3.Document): void {
    if (apiDoc && Array.isArray(apiDoc.tags)) {
      apiDoc.tags.sort((a, b): number => {
        return a.name < b.name ? -1 : 1;
      });
    }
  }

  private getBasePathsFromServers(
    servers: OpenAPIV3.ServerObject[],
  ): BasePath[] {
    if (!servers || servers.length === 0) {
      return [new BasePath({ url: '' })];
    }
    const basePathsMap: { [key: string]: BasePath } = {};
    for (const server of servers) {
      const basePath = new BasePath(server);
      basePathsMap[basePath.expressPath] = basePath;
    }
    return Object.keys(basePathsMap).map((key) => basePathsMap[key]);
  }
}
