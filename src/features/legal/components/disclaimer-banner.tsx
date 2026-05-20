"use client";

export function DisclaimerBanner() {
  return (
    <div className="rounded-md border bg-yellow-50 p-3 text-sm text-yellow-900">
      <p className="font-medium">免責表示</p>
      <p className="mt-1">
        Ruletrade-AI は投資助言を提供しません。AI の出力は参考情報であり、
        最終的な投資判断はユーザー自身の責任で行ってください。
        過去の情報に基づくものであり、将来の収益を保証するものではありません。
      </p>
    </div>
  );
}
