import { useId } from "react";

export function FormField({
  label,
  children,
  error,
  description,
  required,
}: {
  label: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
  error?: string | null;
  description?: string;
  required?: boolean;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-label="必須" className="ml-1 text-red-600">
            *
          </span>
        ) : null}
      </label>
      {description ? (
        <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-1">
        {children({ id, describedBy, invalid: Boolean(error) })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
