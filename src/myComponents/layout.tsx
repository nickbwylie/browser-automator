import React, { useEffect } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { supabase } from "@/supabaseClient";
import Auth from "./Auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [showLogin, setShowLogin] = React.useState(false);

  useEffect(() => {
    //get user from supabase
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // alert("You must be logged in to use the scrape tool");
        setShowLogin(true);
        return;
      }
    }

    checkUser();
  }, []);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        {/* Header with sidebar trigger */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                Browser Automation
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* You can add header actions here */}
            </div>
          </div>
        </header>

        {/* Main content area with explicit overflow handling */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto">
          {showLogin ? <Auth setShowLogin={setShowLogin} /> : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
