import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";

async function ensureTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MemoBoard')
    BEGIN
      CREATE TABLE MemoBoard (
        id INT IDENTITY(1,1) PRIMARY KEY,
        canvas_json NVARCHAR(MAX),
        overlay_data NVARCHAR(MAX),
        updated_at DATETIME DEFAULT GETDATE(),
        updated_by NVARCHAR(50)
      )
    END
  `);
}

export async function GET() {
  try {
    await ensureTable();
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT TOP 1 canvas_json, overlay_data, updated_at FROM MemoBoard ORDER BY id DESC"
    );
    if (result.recordset.length === 0) {
      return NextResponse.json({ canvas_json: null, overlay_data: null });
    }
    return NextResponse.json(result.recordset[0]);
  } catch (err) {
    console.error("GET /api/memo error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const body = await req.json();
    const { canvas_json, overlay_data, updated_by } = body;
    const pool = await getPool();

    const exists = await pool.request().query("SELECT COUNT(*) as cnt FROM MemoBoard");
    if (exists.recordset[0].cnt === 0) {
      await pool
        .request()
        .input("canvas_json", sql.NVarChar(sql.MAX), canvas_json || null)
        .input("overlay_data", sql.NVarChar(sql.MAX), overlay_data || null)
        .input("updated_by", sql.NVarChar(50), updated_by || "")
        .query(
          "INSERT INTO MemoBoard (canvas_json, overlay_data, updated_at, updated_by) VALUES (@canvas_json, @overlay_data, GETDATE(), @updated_by)"
        );
    } else {
      await pool
        .request()
        .input("canvas_json", sql.NVarChar(sql.MAX), canvas_json || null)
        .input("overlay_data", sql.NVarChar(sql.MAX), overlay_data || null)
        .input("updated_by", sql.NVarChar(50), updated_by || "")
        .query(
          "UPDATE MemoBoard SET canvas_json=@canvas_json, overlay_data=@overlay_data, updated_at=GETDATE(), updated_by=@updated_by WHERE id=(SELECT TOP 1 id FROM MemoBoard ORDER BY id DESC)"
        );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/memo error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
