import type { ReactNode } from "react";

export function PreviewSection({ id, title, children }: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="fsd-preview__item" aria-labelledby={id}>
      <h2 className="fsd-preview__label" id={id}>{title}</h2>
      <div className="fsd-preview__stage">{children}</div>
    </section>
  );
}

