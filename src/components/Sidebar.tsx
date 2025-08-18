
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  FileUp, 
  Phone, 
  FileText, 
  Settings, 
  User, 
  Calendar,
  Send
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full justify-start gap-3 px-3 font-normal",
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Button>
  );
};

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Phone },
    { id: "upload", label: "Upload Clients", icon: FileUp },
    { id: "templates", label: "Message Templates", icon: FileText },
    { id: "broadcast", label: "Broadcast", icon: Send },
    { id: "schedule", label: "Schedule", icon: Calendar },
    { id: "clients", label: "Clients", icon: User },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div
      className={cn(
        "bg-sidebar h-screen flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <h1 className="text-xl font-bold text-white">
            <span className="text-broadcast-pink">Voice</span>
            <span className="text-broadcast-blue">Cast</span>
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground/80 hover:text-sidebar-foreground p-1"
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex flex-col gap-1 p-2 flex-grow overflow-y-auto">
        {navItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={collapsed ? "" : item.label}
            active={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </div>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground">
            A
          </div>
          {!collapsed && (
            <div>
              <p className="text-sidebar-foreground text-sm font-medium">Admin User</p>
              <p className="text-sidebar-foreground/60 text-xs">admin@voicecast.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
