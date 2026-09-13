import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const PhotoboothShell = ({ children }: Props) => (
  <div className="photostrip-page">
    <div className="photostrip-noise" aria-hidden="true" />
    <main className="photostrip-machine">
      <section className="photostrip-screen">{children}</section>
    </main>
  </div>
);
