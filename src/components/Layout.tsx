import { useState } from "react";
import { Navbar } from "./Navbar";
import { SideDrawer } from "./SideDrawer";
import { Outlet } from "react-router-dom";

export function Layout() {
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);

  const openSideDrawer = () => setIsSideDrawerOpen(true);
  const closeSideDrawer = () => setIsSideDrawerOpen(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenSideDrawer={openSideDrawer} />
      <SideDrawer isOpen={isSideDrawerOpen} onClose={closeSideDrawer} />

      <main className="pt-20 pb-8">
        <Outlet />
      </main>
    </div>
  );
}