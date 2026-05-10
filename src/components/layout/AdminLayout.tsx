import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  MessageSquare,
  History,
  Send,
  Bell,
  Library,
  IndianRupee,
  CreditCard,
  GraduationCap,
  UserPlus,
  Menu,
  Upload,
  X,
  Search,
  Command as CmdIcon,
  Building2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRoles } from "@/hooks/useStaffRoles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { AtomIcon } from "@/components/icons/AtomIcon";
import RoleSwitcher from "@/components/admin/RoleSwitcher";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const allNavSections = {
  admin: [
    {
      title: "Overview",
      items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin" }],
    },
    {
      title: "Departments",
      items: [
        { icon: GraduationCap, label: "Academic", path: "/admin/academic" },
        { icon: Users, label: "Operations", path: "/admin/operations" },
        { icon: IndianRupee, label: "Finance", path: "/admin/finance" },
      ],
    },
    {
      title: "Content",
      items: [
        { icon: FileText, label: "PDF Tests", path: "/admin/pdf-tests" },
        { icon: ClipboardList, label: "Tests", path: "/admin/tests" },
        { icon: BookOpen, label: "Question Bank", path: "/admin/question-bank" },
        { icon: Library, label: "PhyNetix Library", path: "/admin/phynetix-library" },
        { icon: Upload, label: "Bulk Import", path: "/admin/bulk-import" },
        { icon: BookOpen, label: "DPP Manager", path: "/admin/dpps" },
        { icon: Bell, label: "Batches", path: "/admin/batches" },
      ],
    },
    {
      title: "Management",
      items: [
        { icon: Users, label: "Users", path: "/admin/users" },
        { icon: Building2, label: "Institutions", path: "/admin/institutions" },
        { icon: MessageSquare, label: "Community", path: "/admin/community" },
        { icon: Send, label: "Requests", path: "/admin/requests" },
        { icon: History, label: "Audit Logs", path: "/admin/audit-logs" },
        { icon: Settings, label: "Settings", path: "/admin/settings" },
      ],
    },
  ],
  academic_admin: [
    { title: "Academic", items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin/academic" }] },
    {
      title: "Content",
      items: [
        { icon: FileText, label: "PDF Tests", path: "/admin/pdf-tests" },
        { icon: ClipboardList, label: "Tests", path: "/admin/tests" },
        { icon: BookOpen, label: "Question Bank", path: "/admin/question-bank" },
        { icon: Library, label: "PhyNetix Library", path: "/admin/phynetix-library" },
      ],
    },
    { title: "Batches", items: [{ icon: Bell, label: "Manage Batches", path: "/admin/batches" }] },
  ],
  operations_admin: [
    { title: "Operations", items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin/operations" }] },
    {
      title: "Students",
      items: [
        { icon: Users, label: "Users", path: "/admin/users" },
        { icon: UserPlus, label: "Enrollments", path: "/admin/operations" },
      ],
    },
    { title: "Batches", items: [{ icon: Bell, label: "Manage Batches", path: "/admin/batches" }] },
    {
      title: "Support",
      items: [
        { icon: MessageSquare, label: "Community", path: "/admin/community" },
        { icon: Send, label: "Requests", path: "/admin/requests" },
      ],
    },
  ],
  finance_admin: [
    { title: "Finance", items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin/finance" }] },
    {
      title: "Transactions",
      items: [
        { icon: CreditCard, label: "Payments", path: "/admin/finance" },
        { icon: IndianRupee, label: "Revenue", path: "/admin/finance" },
      ],
    },
    { title: "Batches", items: [{ icon: Bell, label: "Manage Batches", path: "/admin/batches" }] },
  ],
};

const defaultNavSections = [
  { title: "Overview", items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin" }] },
];

function getNavSections(role: AppRole | null) {
  if (!role) return defaultNavSections;
  return allNavSections[role as keyof typeof allNavSections] || defaultNavSections;
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadRequests, setUnreadRequests] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading, signOut, setViewMode } = useAuth();
  const { activeRole, userRoles } = useStaffRoles();
  const { settings: platformSettings } = usePlatformSettings();

  const navSections = useMemo(() => {
    const sections = getNavSections(activeRole);
    if (!platformSettings.show_pdf_tests) {
      return sections.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.path !== "/admin/pdf-tests"),
      }));
    }
    return sections;
  }, [activeRole, platformSettings.show_pdf_tests]);

  // All flat items for command palette
  const allItems = useMemo(() => navSections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title }))), [navSections]);

  // Breadcrumb segments
  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const found = allItems.find((it) => it.path === location.pathname);
    return { parts, current: found?.label || parts[parts.length - 1] || "" };
  }, [location.pathname, allItems]);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && !isAdmin) navigate("/dashboard");
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadRequests();
    const channel = supabase
      .channel("staff-requests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_requests" }, fetchUnreadRequests)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchUnreadRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("staff_requests")
      .select("id")
      .eq("to_user_id", user.id)
      .eq("status", "pending");
    if (data) setUnreadRequests(data.length);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <Link to="/admin" className="flex items-center gap-3 px-4 py-5 border-b border-border/60">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
          <AtomIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <AnimatePresence mode="wait">
          {(!collapsed || mobileOpen) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden">
              <span className="text-base font-bold tracking-wider uppercase text-foreground whitespace-nowrap">
                PhyNetix
              </span>
              <span className="block text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
                Admin Console
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {userRoles.length > 1 && (!collapsed || mobileOpen) && (
        <div className="px-3 py-3 border-b border-border/60">
          <RoleSwitcher collapsed={false} />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <AnimatePresence mode="wait">
              {(!collapsed || mobileOpen) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.15em] px-3 mb-1.5"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const hasNotification = item.path === "/admin/requests" && unreadRequests > 0;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-md transition-all relative",
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />}
                    <div className="relative">
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                      {hasNotification && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                      )}
                    </div>
                    <AnimatePresence mode="wait">
                      {(!collapsed || mobileOpen) && (
                        <motion.span
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          className="text-sm flex-1 truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {(!collapsed || mobileOpen) && hasNotification && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                        {unreadRequests}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 px-2 py-2 space-y-0.5">
        <button
          onClick={() => {
            setViewMode("student");
            navigate("/dashboard");
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors w-full"
        >
          <Shield className="w-[18px] h-[18px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">Student View</span>}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex admin-layout">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-b border-border z-40 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <AtomIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm uppercase tracking-wider text-foreground">PhyNetix</span>
        </div>
        <button
          onClick={() => setCmdOpen(true)}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 h-screen w-[280px] bg-card border-r border-border z-[60]"
            >
              <div className="absolute top-3 right-3">
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 68 : 248 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="hidden lg:block fixed left-0 top-0 h-screen bg-card border-r border-border/60 z-40"
      >
        <SidebarContent />
      </motion.aside>

      {/* Main */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 pt-14 lg:pt-0 min-w-0",
          collapsed ? "lg:ml-[68px]" : "lg:ml-[248px]"
        )}
      >
        {/* Desktop topbar */}
        <header className="hidden lg:flex h-14 sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border/60 items-center gap-3 px-6">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
            {crumbs.parts.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                <span className="text-foreground font-medium capitalize">{crumbs.current}</span>
              </>
            )}
          </nav>

          <div className="flex-1" />

          {/* Cmd+K trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border/60 bg-muted/40 text-muted-foreground text-sm hover:bg-muted transition-colors min-w-[260px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search pages, actions...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono bg-background border border-border/60 rounded px-1.5 py-0.5">
              <CmdIcon className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          <Link
            to="/admin/requests"
            className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Requests"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadRequests > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Link>

          <ThemeToggle />
        </header>

        <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
      </main>

      {/* Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navSections.map((section) => (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${section.title}`}
                  onSelect={() => {
                    setCmdOpen(false);
                    navigate(item.path);
                  }}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { setCmdOpen(false); setViewMode("student"); navigate("/dashboard"); }}>
              <Shield className="w-4 h-4 mr-2" /> Switch to Student View
            </CommandItem>
            <CommandItem onSelect={() => { setCmdOpen(false); handleSignOut(); }}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
