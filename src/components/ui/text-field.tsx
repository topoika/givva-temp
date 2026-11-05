import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  /** Rendered beside the input, e.g. a Verify button. */
  action?: ReactNode;
  /** Rendered under the input, e.g. a verification message. */
  hint?: ReactNode;
  fieldClassName?: string;
};

export function TextField({ id, label, action, hint, fieldClassName, ...input }: TextFieldProps) {
  const control = <input id={id} name={input.name ?? id} {...input} />;
  return (
    <div className={cn("givva-field", fieldClassName)}>
      <label htmlFor={id}>{label}</label>
      {action ? <div className="givva-field-row">{control}{action}</div> : control}
      {hint}
    </div>
  );
}
