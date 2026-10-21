const iconAssets = {
  search: "/assets/staff-search.svg",
  plus: "/assets/staff-plus.svg",
  close: "/assets/staff-close.svg",
  x: "/assets/staff-close.svg",
  check: "/assets/staff-checked.svg",
  "check-circle": "/assets/staff-checked.svg",
  "chevron-left": "/assets/staff-previous.svg",
  "arrow-left": "/assets/staff-previous.svg",
  "chevron-right": "/assets/staff-next.svg",
  "arrow-right": "/assets/staff-next.svg",
  trash: "/assets/staff-remove.svg",
  remove: "/assets/staff-remove.svg",
  info: "/assets/figma/2ffd3.svg",
  id: "/assets/figma/d720d.svg",
};

export function Icon({ name, size = 20, className = "" }) {
  const src = iconAssets[name] || `/assets/figma/nav-${name}.svg`;
  return (
    <span className={`icon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  );
}
