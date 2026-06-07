import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

type MissingColumn = {
  table_name: string;
};

const prisma = new PrismaClient();

const REQUIRED_TABLES = ["Job", "Contract", "Milestone", "PaymentEscrow", "Dispute"] as const;

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260408133000_soft_delete_and_runtime_indexes/migration.sql",
);

async function getMissingDeletedAtTables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<MissingColumn[]>(`
    SELECT candidate.table_name
    FROM (
      VALUES ('Job'), ('Contract'), ('Milestone'), ('PaymentEscrow'), ('Dispute')
    ) AS candidate(table_name)
    LEFT JOIN information_schema.columns cols
      ON cols.table_schema = 'public'
     AND cols.table_name = candidate.table_name
     AND cols.column_name = 'deletedAt'
    WHERE cols.column_name IS NULL
    ORDER BY candidate.table_name
  `);

  return rows.map((row) => row.table_name);
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const before = await getMissingDeletedAtTables();
  if (before.length === 0) {
    console.log("soft-delete drift already repaired");
    return;
  }

  const migrationSql = await readFile(migrationPath, "utf8");
  const statements = splitSqlStatements(migrationSql);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const after = await getMissingDeletedAtTables();
  if (after.length > 0) {
    throw new Error(`soft-delete drift persists for tables: ${after.join(", ")}`);
  }

  console.log(
    JSON.stringify({
      repaired: true,
      tables: before,
      appliedStatements: statements.length,
      expectedTables: REQUIRED_TABLES,
    }),
  );
}

await main().finally(async () => {
  await prisma.$disconnect();
});
