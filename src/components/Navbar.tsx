import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: '#fff', boxShadow: scrolled ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', padding: scrolled ? '8px 0' : '16px 0', transition: 'all 0.3s', fontFamily: 'Roboto, Arial, sans-serif'
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            style={{ minWidth: 40, minHeight: 40, marginRight: 8, background: 'none', border: 'none', boxShadow: 'none' }}
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
          <Link to="/" style={{ fontSize: 22, fontWeight: 700, color: '#333', textDecoration: 'none', letterSpacing: 1 }}>Produx</Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ fontSize: 15, fontWeight: 500, color: '#555', textDecoration: 'none', marginRight: 8 }}>Dashboard</Link>
          <Link to="/settings" style={{ fontSize: 15, fontWeight: 500, color: '#555', textDecoration: 'none', marginRight: 8 }}>Settings</Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button style={{ border: '1px solid #3f51b5', color: '#3f51b5', background: 'none', fontWeight: 500, letterSpacing: 1 }}>
            <Link to="/auth" style={{ color: '#3f51b5', textDecoration: 'none', fontWeight: 500 }}>Get Started</Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}