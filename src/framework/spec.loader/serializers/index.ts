import { Serializer } from "../../types";

export const dateTime: Serializer = {
    format: 'date-time',
    serialize: (d: Date) => {
      return d && d.toISOString();
    },
  };
  
  export const date: Serializer = {
    format: 'date',
    serialize: (d: Date) => {
      return d && d.toISOString().split('T')[0];
    },
  };