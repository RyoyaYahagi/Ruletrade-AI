export function SkipLink({ label = "本文へ移動" }: { label?: string }) {
  return (
    <a href="#main-content" className="skip-link">
      {label}
    </a>
  );
}
