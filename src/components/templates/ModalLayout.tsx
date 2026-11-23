import { type ReactElement, type ReactNode, useEffect } from 'react';

interface ModalLayoutProps {
  title: string;
  children: ReactNode;
  /** Buttons row; primary on the right. */
  actions?: ReactNode;
  /** Omit for a modal that can't be dismissed (e.g. a required API key). */
  onClose?: () => void;
}

/** Bottom sheet on surface-2: content within thumb reach. Closes on backdrop tap or Escape. */
export function ModalLayout({ title, children, actions, onClose }: ModalLayoutProps): ReactElement {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      {onClose ? (
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 bg-surface-0/70"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-0/70" />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] flex-col gap-4 rounded-t-lg bg-surface-2 px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <h2 className="text-title font-medium">{title}</h2>
        {/* Side padding keeps borders and focus rings from being clipped by the scroll box. */}
        <div className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1 pb-1">{children}</div>
        {actions && <div className="flex gap-3 [&>*]:flex-1">{actions}</div>}
      </section>
    </div>
  );
}
