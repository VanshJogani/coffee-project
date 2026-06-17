import React from "react";
import MobileBottomNav from "./MobileBottomNav";

function AppLayout({ children }) {
  return (
    <>
      <div className="pb-16 md:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </>
  );
}

export default AppLayout;
