import { NavLink } from "react-router";

export function AppNav() {
  return (
    <nav className="bg-surface-muted border-border text-text flex gap-page border-b p-page">
      <NavLink to="/" end className="text-text hover:text-primary">
        Home
      </NavLink>
      <NavLink to="/about" end className="text-text hover:text-primary">
        About
      </NavLink>
    </nav>
  );
}
