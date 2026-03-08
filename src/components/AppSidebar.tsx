import {
  LayoutDashboard,
  ShoppingCart,
  PackagePlus,
  Package,
  FolderTree,
  Truck,
  Users,
  BarChart3,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Bán hàng", url: "/sales", icon: ShoppingCart },
  { title: "Nhập hàng", url: "/imports", icon: PackagePlus },
  { title: "Hàng hóa", url: "/products", icon: Package },
  { title: "Nhóm sản phẩm", url: "/categories", icon: FolderTree },
  { title: "Nhà cung cấp", url: "/suppliers", icon: Truck },
  { title: "Khách hàng", url: "/customers", icon: Users },
  { title: "Báo cáo", url: "/reports", icon: BarChart3 },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        {!collapsed ? (
          <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
            📦 KiotPOS
          </h1>
        ) : (
          <span className="text-lg">📦</span>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
