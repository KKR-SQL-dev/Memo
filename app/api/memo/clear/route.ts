import { NextResponse } from "next/server";
import { getPool } from "@/lib/mssql";

export async function POST() {
  try {
    const pool = await getPool();
    await pool.request().query(
      "UPDATE MemoBoard SET canvas_json=NULL, overlay_data=NULL, updated_at=GETDATE() WHERE id=(SELECT TOP 1 id FROM MemoBoard ORDER BY id DESC)"
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/memo/clear error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
