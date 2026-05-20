import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";

// POST: 특정 이력으로 복구
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { backupId } = body;
    if (!backupId) {
      return NextResponse.json({ error: "backupId required" }, { status: 400 });
    }
    const pool = await getPool();
    const backup = await pool.request()
      .input("id", sql.Int, backupId)
      .query("SELECT canvas_json, overlay_data FROM MemoBoard_Backup WHERE id=@id");

    if (backup.recordset.length === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const { canvas_json, overlay_data } = backup.recordset[0];
    await pool.request()
      .input("canvas_json", sql.NVarChar(sql.MAX), canvas_json)
      .input("overlay_data", sql.NVarChar(sql.MAX), overlay_data)
      .query(
        "UPDATE MemoBoard SET canvas_json=@canvas_json, overlay_data=@overlay_data, updated_at=GETDATE(), updated_by='restore' WHERE id=(SELECT TOP 1 id FROM MemoBoard ORDER BY id DESC)"
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/memo/history/restore error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
