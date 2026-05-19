import { NextResponse } from "next/server";
import { exec } from "node:child_process";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    exec(
      `powershell -Command "& 'C:\\Program Files\\Common Files\\microsoft shared\\ink\\TabTip.exe'"`,
      (err) => {
        if (err) {
          resolve(NextResponse.json({ ok: false, error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ ok: true }));
        }
      }
    );
  });
}
