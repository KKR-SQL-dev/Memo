"use client";

import dynamic from "next/dynamic";

const MemoCanvas = dynamic(() => import("@/components/memo/MemoCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-500 text-sm">메모장 로딩 중...</div>
    </div>
  ),
});

export default function Page() {
  return <MemoCanvas />;
}
