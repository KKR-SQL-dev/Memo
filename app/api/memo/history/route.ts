import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/mssql";

async function ensureBackupTable() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MemoBoard_Backup')
    BEGIN
      CREATE TABLE MemoBoard_Backup (
        id INT IDENTITY(1,1) PRIMARY KEY,
        canvas_json NVARCHAR(MAX),
        overlay_data NVARCHAR(MAX),
        backed_up_at DATETIME DEFAULT GETDATE()
      )
    END
  `);
}

// GET: 이력 목록 조회
export async function GET() {
  try {
    await ensureBackupTable();
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, CONVERT(VARCHAR(19), backed_up_at, 120) as backed_up_at FROM MemoBoard_Backup ORDER BY id DESC
    `);
    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("GET /api/memo/history error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// POST: 현재 상태를 이력으로 저장 (스냅샷)
export async function POST() {
  try {
    await ensureBackupTable();
    const pool = await getPool();
    // 현재 메모 데이터를 백업 테이블에 복사
    await pool.request().query(`
      INSERT INTO MemoBoard_Backup (canvas_json, overlay_data, backed_up_at)
      SELECT canvas_json, overlay_data, GETDATE()
      FROM MemoBoard WHERE id=(SELECT TOP 1 id FROM MemoBoard ORDER BY id DESC)
      AND canvas_json IS NOT NULL AND LEN(canvas_json) > 10
    `);
    // 최대 20건만 유지
    await pool.request().query(`
      DELETE FROM MemoBoard_Backup WHERE id NOT IN (
        SELECT TOP 20 id FROM MemoBoard_Backup ORDER BY id DESC
      )
    `);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/memo/history error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
