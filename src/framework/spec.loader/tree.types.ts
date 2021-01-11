import { OpenAPIV3 } from '../types';

export type SchemaObject = OpenAPIV3.SchemaObject;
export type SchemaObjectNode = Node<SchemaObject, SchemaObject>;

export class Node<T, P> {
  public readonly path: string[];
  public readonly parent: P;
  public readonly schema: T;
  constructor(parent: P, schema: T, path: string[]) {
    this.path = path;
    this.parent = parent;
    this.schema = schema;
  }
}

export class Root<T> extends Node<T, T> {
  constructor(schema: T, path: string[]) {
    super(null, schema, path);
  }
}
