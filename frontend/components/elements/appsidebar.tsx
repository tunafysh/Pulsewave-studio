"use client"
import { UserRound, Home, Inbox, LogOut, ArrowRightFromLine } from "lucide-react";
import { Button } from "../ui/button";
import { Sidebar, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../ui/sidebar";
import { ModeToggle } from "./themetoggle";
import { Collapsible, CollapsibleContent } from "@radix-ui/react-collapsible";
import { CollapsibleTrigger } from "../ui/collapsible";
import { useRouter } from "next/navigation";

export default function AppSidebar() {
    const router = useRouter()
    const {state} = useSidebar()
    const items = [
      {
        title: "Home",
        url: "/",
        icon: Home,
      },
      {
        title: "Categories",
        url: "#",
        icon: Inbox,
      },
      {
        title: "Artists",
        url: "#",
        icon: UserRound,
      },
    ]
    return (
        <Sidebar variant="floating" className="m-2 h-[90%] rounded-md">
            <SidebarHeader className="flex items-center justify-center p-4 flex-row">
                {state == "expanded"? <h1 className="text-xl font-bold">Pulse<span className="text-primary">wave</span></h1> : <></>}
            </SidebarHeader>
            <SidebarGroup className="h-full">
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="cursor-pointer">
                    <a onClick={() => router.push(item.url)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
          
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>

            </SidebarGroup>
            <SidebarFooter className="p-2">
            <Button
              variant="ghost"
              className="w-full justify-start rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => router.push("/convert")}
            >
              <ArrowRightFromLine className="mr-2 h-6 w-6" />
              Convert
            </Button>
              <div className="flex-row w-full">

            <Button
              variant="ghost"
              className="w-[83%] justify-start rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            >
              <LogOut className="mr-2 h-6 w-6" />
              Logout
            </Button>
            <ModeToggle/>
              </div>

            </SidebarFooter>
        </Sidebar>
    );
}