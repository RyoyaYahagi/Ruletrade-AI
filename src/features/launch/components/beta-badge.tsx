export function BetaBadge() {
  if (process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== "true") return null;
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
      Closed Beta
    </span>
  );
}
