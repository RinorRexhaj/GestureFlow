"use client";

import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import SettingsModal from "./SettingsModal";

const ShellClient = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
      {/* <Sidebar /> */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {/* Main — offset for fixed sidebar (ml-24) and top bar (pt-24) */}
      <main className="ml-24 pt-24 px-8 min-h-screen overflow-y-auto pb-32 sm:ml-0 sm:pb-24">
        {children}
      </main>
    </>
  );
};

export default ShellClient;
