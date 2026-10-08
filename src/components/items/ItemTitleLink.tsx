import { parseHttpUrl, type Item } from "@/lib/items";

export default function ItemTitleLink({
  item,
  className,
}: {
  item: Pick<Item, "title" | "url">;
  className: string;
}) {
  const href = parseHttpUrl(item.url);
  const style = { color: "var(--ink)" };

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open website in a new tab"
      className={`${className} hover:underline`}
      style={style}
    >
      {item.title}
    </a>
  ) : (
    <span className={className} style={style}>
      {item.title}
    </span>
  );
}
