import { db, organizationsTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { DEFAULT_ROLE_PERMISSIONS } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DEFAULT_ROLES = [
  { slug: "visitor_manager", name: "Visitor Manager" },
  { slug: "receptionist", name: "Receptionist" },
  { slug: "host_employee", name: "Host Employee" },
];

async function seedRolesForOrg(orgId: string, orgName: string) {
  console.log(`\nSeeding roles for org: ${orgName} (${orgId})`);
  for (const r of DEFAULT_ROLES) {
    const existing = await db.select().from(rolesTable)
      .where(and(eq(rolesTable.orgId, orgId), eq(rolesTable.slug, r.slug)))
      .limit(1);

    if (existing[0]) {
      console.log(`  [SKIP] Role '${r.slug}' already exists`);
      continue;
    }

    const roleId = generateId();
    await db.insert(rolesTable).values({
      id: roleId,
      orgId,
      name: r.name,
      slug: r.slug,
      isSystem: false,
      isDefault: true,
      isActive: true,
    });

    const perms = DEFAULT_ROLE_PERMISSIONS[r.slug] ?? [];
    if (perms.length > 0) {
      await db.insert(rolePermissionsTable).values(
        perms.map(p => ({ id: generateId(), roleId, permission: p as string }))
      );
    }

    console.log(`  [OK] Created role '${r.slug}' with ${perms.length} permissions`);
  }
}

async function main() {
  console.log("=== Seeding default roles for existing organizations ===");

  const orgs = await db.select({ id: organizationsTable.id, name: organizationsTable.name })
    .from(organizationsTable);

  if (orgs.length === 0) {
    console.log("No organizations found.");
    process.exit(0);
  }

  console.log(`Found ${orgs.length} organization(s)`);

  for (const org of orgs) {
    await seedRolesForOrg(org.id, org.name);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
