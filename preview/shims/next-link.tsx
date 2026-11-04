/** Preview-only stand-in for next/link: renders a real <a> with a #page href and routes in memory. */
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./next-navigation";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean };

function display(href: string) {
  const [p, frag] = href.split("#");
  const path = p.split("?")[0];
  if (!path && frag) return `#${frag}`;
  if (path === "/" || path === "") return "#home";
  if (path.startsWith("/activity/")) return `#activity-${path.slice(10)}`;
  return `#${path.slice(1)}`;
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, onClick, prefetch: _p, scroll: _s, ...rest }, ref) {
  void _p;
  void _s;
  const external = /^https?:/.test(href);
  return (
    <a
      ref={ref}
      href={external ? href : display(href)}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || external || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
});

export default Link;
