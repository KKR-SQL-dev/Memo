import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { ink, language = "ko" } = await req.json();

    const response = await fetch(
      "https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: "enable_pre_space",
          requests: [
            {
              writing_guide: { writing_area_width: 1000, writing_area_height: 500 },
              ink,
              language,
            },
          ],
        }),
      },
    );

    const data = await response.json();

    // Google 응답: ["SUCCESS", [["", ["후보1","후보2",...], ...]]]
    if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.[0]) {
      return NextResponse.json({ text: data[1][0][1][0] });
    }

    return NextResponse.json({ text: "" });
  } catch (err) {
    return NextResponse.json({ text: "", error: (err as Error).message }, { status: 500 });
  }
}
