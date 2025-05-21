import { useState } from "react";
import { Navbar } from "./Navbar";
import { SideDrawer } from "./SideDrawer";
import { Outlet } from "react-router-dom";
import { theme } from "@/theme";

export function Layout() {
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);

  const openSideDrawer = () => setIsSideDrawerOpen(true);
  const closeSideDrawer = () => setIsSideDrawerOpen(false);

  return (
    <div style={{ minHeight: "100vh", background: theme.colors.background }}>
      <Navbar onOpenSideDrawer={openSideDrawer} />
      <SideDrawer isOpen={isSideDrawerOpen} onClose={closeSideDrawer} />

      <main
        style={{
          paddingTop: 64,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}