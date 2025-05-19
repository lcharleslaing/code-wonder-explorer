import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { theme } from "@/theme";

interface NavbarProps {
  onOpenSideDrawer: () => void;
}

export function Navbar({ onOpenSideDrawer }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  // Add scroll effect to navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "#fff",
        boxShadow: scrolled ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        padding: scrolled ? `${theme.spacing.sm}px 0` : `${theme.spacing.md}px 0`,
        transition: "all 0.3s",
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: theme.containerMaxWidth,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
          <Button
            variant="ghost"
            size="icon"
            style={{ marginRight: theme.spacing.xs }}
            onClick={onOpenSideDrawer}
            aria-label="Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </Button>
          <Link
            to="/"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: theme.colors.text,
              textDecoration: "none",
              letterSpacing: 1,
            }}
          >
            Produx
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
          <Link
            to="/"
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#555",
              textDecoration: "none",
              marginRight: theme.spacing.xs,
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#555",
              textDecoration: "none",
              marginRight: theme.spacing.xs,
            }}
          >
            Settings
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
          <Button variant="outline" asChild>
            <Link to="/auth">Get Started</Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}