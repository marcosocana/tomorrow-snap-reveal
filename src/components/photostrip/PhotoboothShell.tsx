import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  eyebrow?: string;
};

export const PhotoboothShell = ({ children, eyebrow = "PHOTOSTRIP · REVELAO" }: Props) => (
  <div className="photostrip-page">
    <div className="photostrip-noise" aria-hidden="true" />
    <main className="photostrip-machine">
      <div className="photostrip-machine-top" aria-hidden="true">
        <span className="photostrip-camera-lens" />
        <span className="photostrip-machine-label">PHOTO<br />BOOTH</span>
        <span className="photostrip-status-light" />
      </div>
      <p className="photostrip-eyebrow">{eyebrow}</p>
      <section className="photostrip-screen">{children}</section>
      <div className="photostrip-controls" aria-hidden="true">
        <span className="photostrip-dial" />
        <span className="photostrip-small-label">LOOK HERE</span>
        <span className="photostrip-button-drawing" />
      </div>
      <div className="photostrip-slot" aria-hidden="true"><span /></div>
    </main>
  </div>
);
