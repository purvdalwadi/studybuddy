import React from "react";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col h-full overflow-hidden ml-0 md:ml-64">
          <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Bottom Navigation - Only visible on mobile */}
      <div className="md:hidden h-16 flex-shrink-0">
        {/* This is a spacer that matches the height of the bottom navigation */}
      </div>
    </div>
  );
}
