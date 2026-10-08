import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ItemUndoProvider from "@/components/items/ItemUndoProvider";

/**
 * Everything behind the sign-in wall: the three lists, the item form, profile.
 *
 * The route group adds no path segment, so these pages keep their URLs — it
 * exists purely so the signed-in chrome (and the session read it needs) applies
 * here and not to the public pages.
 *
 * `flex-1` on the content keeps the footer at the bottom of the viewport on
 * short pages (an empty list, the 404) instead of floating up under the header.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ItemUndoProvider>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </ItemUndoProvider>
  );
}
