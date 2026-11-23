import type { ReactElement, ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  /** Thumb zone above the nav: the mic on Home. */
  action?: ReactNode;
  nav: ReactNode;
}

/** Reading content scrolls on top; the action and nav stay at the bottom. */
export function MainLayout({ children, action, nav }: MainLayoutProps): ReactElement {
  return (
    <div className="flex h-dvh flex-col">
      <main className="flex-1 overflow-y-auto px-6 pt-8 pb-6">{children}</main>
      {action && <div className="flex justify-center px-6 pt-4 pb-6">{action}</div>}
      <div className="pb-[env(safe-area-inset-bottom)]">{nav}</div>
    </div>
  );
}
