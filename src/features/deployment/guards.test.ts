import { describe, it, expect } from "vitest";
import {
  verifyProjectAccess,
  validatePendingMigrations,
} from "../../../scripts/lib/deployment-guards.cjs";
describe("deployment safeguards", () => {
  it("requires access to the existing Fraggy project rather than another account project", () => {
    expect(() => verifyProjectAccess([{ id: "another-project" }])).toThrow(
      "Fraggy",
    );
    expect(() =>
      verifyProjectAccess([{ id: "flczhwwlvfnkqmtxpkmq" }]),
    ).not.toThrow();
  });
  it("permits only the reviewed pending migration and an already current database", () => {
    expect(
      validatePendingMigrations(
        "Would push: 20261112163422_complete_app_catalog.sql",
      ),
    ).toEqual(["20261112163422_complete_app_catalog.sql"]);
    expect(
      validatePendingMigrations("20261113002555_public_collector_social.sql"),
    ).toEqual(["20261113002555_public_collector_social.sql"]);
    expect(validatePendingMigrations("Remote database is up to date.")).toEqual(
      [],
    );
    expect(() =>
      validatePendingMigrations("Would push: 20261101000000_unreviewed.sql"),
    ).toThrow("review");
    expect(() => validatePendingMigrations("unknown response")).toThrow(
      "inspect",
    );
  });
});

it("never deploys the gateway when the database migration fails", async () => {
  const { deployBackend } =
    await import("../../../scripts/lib/deployment-guards.cjs");
  const seen: string[] = [];
  expect(() =>
    deployBackend(
      (args: string[]) => {
        seen.push(args.join(" "));
        if (args[0] === "db") throw Error("migration failed");
      },
      () => "20261112163422_complete_app_catalog.sql",
    ),
  ).toThrow("migration failed");
  expect(seen.some((action) => action.startsWith("functions deploy"))).toBe(
    false,
  );
});
