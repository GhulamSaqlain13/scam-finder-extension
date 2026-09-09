import Link from "next/link";

export type PreviewLink = { file: string; description: string; href: string };

export function PreviewLinks({ items }: { items: readonly PreviewLink[] }) {
  return (
    <ul className="fsd-actions" data-risk="low">
      {items.map(({ file, description, href }) => (
        <li key={file}>
          <span><Link href={href}>{file}</Link> {description}</span>
        </li>
      ))}
    </ul>
  );
}
