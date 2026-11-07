import type { Bucket } from "@/schemas/stock";

export const BUCKET_LABELS: Record<Bucket, string> = {
  core: "コア",
  satellite: "サテライト",
  unclassified: "未分類",
};

export const BUCKET_OPTIONS: ReadonlyArray<{
  value: Bucket;
  label: string;
  description: string;
}> = [
  {
    value: "core",
    label: BUCKET_LABELS.core,
    description: "インデックスなど、判断を介在させない資産",
  },
  {
    value: "satellite",
    label: BUCKET_LABELS.satellite,
    description: "個別株など、自分の判断で動かす資産",
  },
  {
    value: "unclassified",
    label: BUCKET_LABELS.unclassified,
    description: "まだ区分を決めていない資産（割合ではサテライト扱い）",
  },
];

export function bucketLabel(bucket: Bucket): string {
  return BUCKET_LABELS[bucket];
}
