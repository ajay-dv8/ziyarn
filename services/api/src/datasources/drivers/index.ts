import type {
  AnyConnection,
  DbDriver,
} from "@repo/api/datasources/drivers/types";
import { createPostgresDriver } from "@repo/api/datasources/drivers/postgres";
import { createMysqlDriver } from "@repo/api/datasources/drivers/mysql";
import { createMongodbDriver } from "@repo/api/datasources/drivers/mongodb";
import { createConvexDriver } from "@repo/api/datasources/drivers/convex";

export async function createDriver(
  connection: AnyConnection,
): Promise<DbDriver> {
  switch (connection.type) {
    case "postgres":
      return createPostgresDriver(connection);
    case "mysql":
      return createMysqlDriver(connection);
    case "mongodb":
      return createMongodbDriver(connection);
    case "convex":
      return createConvexDriver(connection);
  }
}
