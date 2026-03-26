import { canManageOfficeUsers } from "@acre/auth";
import { getSeededWorkspaceSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeUsers(context.currentMembership)) {
    return NextResponse.json({ error: "User management access required." }, { status: 403 });
  }

  try {
    const snapshot = await getSeededWorkspaceSnapshot();

    if (!snapshot) {
      return NextResponse.json(
        {
          status: "not_found",
          message: "No seeded Acre workspace was found. Run the Prisma migration and seed workflow first."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "ok",
      snapshot
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        message: "Database query failed. Confirm DATABASE_URL, run the migration workflow, and seed the database.",
        error: error instanceof Error ? error.message : "Unknown database error"
      },
      { status: 503 }
    );
  }
}
