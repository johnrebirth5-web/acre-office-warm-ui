import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client";

export type DatabaseHealthStatus = "available" | "unavailable";

export type DatabaseHealthCheck = {
  status: DatabaseHealthStatus;
};

export type DatabaseHealthCheckClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: readonly unknown[]
  ): Promise<T>;
};

export type DatabaseHealthCheckOptions = {
  client?: DatabaseHealthCheckClient;
  hasDatabaseUrl?: boolean;
};

export async function getDatabaseHealthCheck(
  options: DatabaseHealthCheckOptions = {},
): Promise<DatabaseHealthCheck> {
  const hasDatabaseUrl = options.hasDatabaseUrl ?? Boolean(process.env.DATABASE_URL);
  const client = options.client ?? getPrismaClient();

  if (!hasDatabaseUrl) {
    return { status: "unavailable" };
  }

  try {
    await client.$queryRaw(Prisma.sql`SELECT 1`);
    return { status: "available" };
  } catch {
    return { status: "unavailable" };
  }
}
