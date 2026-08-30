export type IntrospectedColumn = {
  name: string;
  type: string;
};

export type IntrospectedTable = {
  name: string;
  columns: IntrospectedColumn[];
  rowCount: number | null;
};

export type SampleRow = Record<string, unknown>;

export type PostgresConnection = {
  type: "postgres";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

export type MysqlConnection = {
  type: "mysql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

export type MongodbConnection = {
  type: "mongodb";
  uri: string;
  database?: string;
};

export type ConvexConnection = {
  type: "convex";
  url: string;
  deployKey: string;
};

export type AnyConnection =
  | PostgresConnection
  | MysqlConnection
  | MongodbConnection
  | ConvexConnection;

export type DbDriver = {
  testConnection(): Promise<void>;
  listTables(): Promise<IntrospectedTable[]>;
  sampleRows(tableName: string, limit: number): Promise<SampleRow[]>;
  queryRows(tableName: string, opts: { limit: number; offset: number }): Promise<SampleRow[]>;
  close(): Promise<void>;
};
