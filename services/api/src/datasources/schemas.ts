import { z } from "zod";

export const dataSourceTypeSchema = z.enum([
  "postgres",
  "mysql",
  "mongodb",
  "convex",
]);

export const SAMPLE_ROW_LIMIT = 10;

export const connectDataSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("postgres"),
    domainId: z.uuid(),
    agentId: z.uuid(),
    label: z.string().trim().min(1).max(100),
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535).default(5432),
    database: z.string().trim().min(1).max(100),
    username: z.string().trim().min(1).max(128),
    password: z.string().min(1).max(512),
  }),
  z.object({
    type: z.literal("mysql"),
    domainId: z.uuid(),
    agentId: z.uuid(),
    label: z.string().trim().min(1).max(100),
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535).default(3306),
    database: z.string().trim().min(1).max(100),
    username: z.string().trim().min(1).max(128),
    password: z.string().min(1).max(512),
  }),
  z.object({
    type: z.literal("mongodb"),
    domainId: z.uuid(),
    agentId: z.uuid(),
    label: z.string().trim().min(1).max(100),
    uri: z.string().trim().min(1).max(1024).startsWith("mongodb"),
    database: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.literal("convex"),
    domainId: z.uuid(),
    agentId: z.uuid(),
    label: z.string().trim().min(1).max(100),
    url: z.string().url().max(255),
    deployKey: z.string().trim().min(10).max(512),
  }),
]);

export const listDataSourcesSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
});

export const updateDataSourceTablesSchema = z.object({
  domainId: z.uuid(),
  dataSourceId: z.uuid(),
  selections: z
    .array(
      z
        .object({
          tableName: z.string().trim().min(1).max(200),
          included: z.boolean().optional(),
          includeProducts: z.boolean().optional(),
          includeOrders: z.boolean().optional(),
        })
        .refine(
          (data) =>
            data.included !== undefined ||
            data.includeProducts !== undefined ||
            data.includeOrders !== undefined,
          {
            message:
              "Each selection must set included, includeProducts, or includeOrders",
          },
        ),
    )
    .min(1)
    .max(500),
});

export const syncDataSourceSchema = z.object({
  domainId: z.uuid(),
  dataSourceId: z.uuid(),
});

export const deleteDataSourceSchema = z.object({
  domainId: z.uuid(),
  dataSourceId: z.uuid(),
});

export type DataSourceType = z.infer<typeof dataSourceTypeSchema>;
export type ConnectDataSourceInput = z.infer<typeof connectDataSourceSchema>;
export type ListDataSourcesInput = z.infer<typeof listDataSourcesSchema>;
export type UpdateDataSourceTablesInput = z.infer<
  typeof updateDataSourceTablesSchema
>;
export type SyncDataSourceInput = z.infer<typeof syncDataSourceSchema>;
export type DeleteDataSourceInput = z.infer<typeof deleteDataSourceSchema>;
