"use client"
import { Menu } from "lucide-react";
import { Sidebar, SidebarFooter, SidebarHeader, useSidebar } from "./ui/sidebar";

export default function AppSidebar() {
    const {state, toggleSidebar} = useSidebar()
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="flex items-center justify-between p-4 flex-row">
                {state == "expanded"? <h1 className="text-xl font-bold">Welcome <span className="text-primary">Hanan</span></h1> : <></>}
                <Menu width={32} height={32} onClick={() => toggleSidebar()}/>
            </SidebarHeader>
            <SidebarFooter>

            </SidebarFooter>
        </Sidebar>
    );
}