const navItems = [
  { label: "Connect",   href: "/connect" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Variances", href: "/variances" },
  { label: "Forecast",  href: "/forecast" },
  { label: "Report",    href: "/export" },
];

export default function Header({ reportCount }: { reportCount: number }) {
  return (
    <div className="optima-headerbar">
      <nav className="ns-topnav">
        {navItems.map((item, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="ns-topnav-sep">—</span>}
            <a href={item.href} className="ns-topnav-item">{item.label}</a>
          </span>
        ))}
      </nav>
      <div className="header-right">
        <span className="header-workspace">
          jobbyta: <span>Nordsheet Finance team</span>
        </span>
        <div className="header-icon">🔒</div>
        <div className="header-icon">👤</div>
      </div>
    </div>
  );
}
