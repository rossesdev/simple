import type { ButtonHTMLAttributes, ReactElement } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent',
  secondary: 'border border-line text-ink',
};

/** One primary per screen or modal; everything else is secondary. No disabled look by design. */
export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={`h-control rounded-md px-6 text-body font-medium transition-transform active:scale-[0.98] ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
