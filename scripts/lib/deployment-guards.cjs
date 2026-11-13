const projectId = "flczhwwlvfnkqmtxpkmq";
const migration = "20261112163422_complete_app_catalog.sql";
function verifyProjectAccess(value) {
  const projects = Array.isArray(value) ? value : value?.projects;
  if (!Array.isArray(projects) || !projects.some((p) => p.id === projectId))
    throw Error(
      "This Supabase account does not list the existing Fraggy project. Sign in to its owner account before deploying.",
    );
}
function validatePendingMigrations(output) {
  const found = [...new Set(output.match(/\b\d{14}_[a-z0-9_]+\.sql\b/g) || [])];
  if (
    found.some(
      (name) =>
        ![migration, "20261113002555_public_collector_social.sql"].includes(
          name,
        ),
    )
  )
    throw Error(
      "Unexpected pending database migrations: review the dry run before deploying.",
    );
  if (!found.length && !/up.to.date|no.pending|no.new.migrations/i.test(output))
    throw Error(
      "Could not identify the migration plan. Please inspect the dry-run output before deploying.",
    );
  return found;
}
function deployBackend(run, capture) {
  run(["link", "--project-ref", projectId]);
  const pending = validatePendingMigrations(
    capture(["db", "push", "--linked", "--dry-run"]),
  );
  if (pending.length) run(["db", "push", "--linked"]);
  run([
    "functions",
    "deploy",
    "beta-gateway",
    "--project-ref",
    projectId,
    "--no-verify-jwt",
    "--use-api",
  ]);
}
module.exports = {
  projectId,
  migration,
  verifyProjectAccess,
  validatePendingMigrations,
  deployBackend,
};
