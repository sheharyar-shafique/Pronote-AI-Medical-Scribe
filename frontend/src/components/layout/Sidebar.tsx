import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Mic,
  MessageSquare,
  Upload,
  FileText,
  LayoutTemplate,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Users,
  Users2,
  BarChart2,
  Sparkles,
  Star,
} from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { useAuthStore } from '../../store';

const menuItems = [
  { name: 'Dashboard',  icon: LayoutDashboard, href: '/dashboard',  color: 'from-emerald-400 to-teal-500' },
  { name: 'Capture',    icon: Mic,             href: '/capture',    color: 'from-rose-400 to-pink-500' },
  { name: 'Dictation',  icon: MessageSquare,   href: '/dictation',  color: 'from-violet-400 to-purple-500' },
  { name: 'Upload',     icon: Upload,          href: '/upload',     color: 'from-blue-400 to-indigo-500' },
  { name: 'Notes',      icon: FileText,        href: '/notes',      color: 'from-amber-400 to-orange-500' },
  { name: 'Templates',  icon: LayoutTemplate,  href: '/templates',  color: 'from-cyan-400 to-sky-500' },
  { name: 'Analytics',  icon: BarChart2,       href: '/analytics',  color: 'from-violet-400 to-purple-500' },
  { name: 'Settings',   icon: Settings,        href: '/settings',   color: 'from-slate-400 to-gray-500' },
];

const adminItems = [
  { name: 'Admin', icon: Users, href: '/admin', color: 'from-red-400 to-rose-500' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SidebarContent is defined OUTSIDE Sidebar so React never treats it as a new
// component on re-renders, which would reset Framer Motion animations (= blink).
// ─────────────────────────────────────────────────────────────────────────────
interface SidebarContentProps {
  collapsed:        boolean;
  pathname:         string;
  userName:         string;
  userSpecialty:    string;
  userInitial:      string;
  allMenuItems:     typeof menuItems;
  isCollapsed:      boolean;
  trialDaysLeft:    number | null;
  onToggleCollapse: () => void;
  onLogout:         () => void;
}

const SidebarContent = memo((
{
  collapsed,
  pathname,
  userName,
  userSpecialty,
  userInitial,
  allMenuItems,
  trialDaysLeft,
  onToggleCollapse,
  onLogout,
}: SidebarContentProps) => (
  <div className="flex flex-col h-full">
    {/* Logo */}
    <div className={`p-5 border-b border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
      <Link to="/dashboard" className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        {/* No Framer Motion here — plain CSS transition prevents blink */}
        {!collapsed && (
          <div>
            <span className="text-white font-bold text-lg tracking-tight">Pronote</span>
            <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
          </div>
        )}
      </Link>
    </div>

    {/* Navigation */}
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {allMenuItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.name}
            to={item.href}
            title={collapsed ? item.name : undefined}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
              isActive
                ? 'bg-white/15 text-white shadow-lg'
                : 'text-slate-400 hover:bg-white/8 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl bg-white/10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <div
              className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                isActive
                  ? `bg-gradient-to-br ${item.color} shadow-lg`
                  : 'bg-white/5 group-hover:bg-white/10'
              }`}
            >
              <item.icon size={16} className={isActive ? 'text-white' : ''} />
            </div>
            {/* Plain span — no framer-motion fade so typing never re-triggers it */}
            {!collapsed && (
              <span className="font-medium text-sm relative z-10">{item.name}</span>
            )}
            {isActive && !collapsed && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 relative z-10 block" />
            )}
          </Link>
        );
      })}
    </nav>

    {/* Trial countdown badge */}
    {trialDaysLeft !== null && (
      <div className={`px-3 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div
            title={`Trial: ${trialDaysLeft}d left`}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 ${
              trialDaysLeft <= 3
                ? 'border-red-400 text-red-400 bg-red-400/10'
                : trialDaysLeft <= 7
                ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                : 'border-emerald-400 text-emerald-400 bg-emerald-400/10'
            }`}
          >
            {trialDaysLeft}
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold ${
            trialDaysLeft <= 3
              ? 'border-red-400/50 bg-red-400/10 text-red-300'
              : trialDaysLeft <= 7
              ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
              : 'border-white/20 bg-white/5 text-slate-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${
              trialDaysLeft <= 3 ? 'bg-red-400' : trialDaysLeft <= 7 ? 'bg-amber-400' : 'bg-slate-400'
            }`} />
            {trialDaysLeft === 0
              ? 'Trial expires today!'
              : `Your trial expires in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`
            }
          </div>
        )}
      </div>
    )}

    {/* User Profile */}
    <div className="p-3 border-t border-white/10 space-y-2">
      {!collapsed && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-slate-400 text-xs truncate">{userSpecialty}</p>
          </div>
        </div>
      )}

      <button
        onClick={onToggleCollapse}
        className={`hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-all ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <ChevronLeft
          size={18}
          className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
        />
        {!collapsed && <span className="text-sm font-medium">Collapse</span>}
      </button>

      <button
        onClick={onLogout}
        title={collapsed ? 'Logout' : undefined}
        className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <LogOut size={18} />
        {!collapsed && <span className="text-sm font-medium">Sign out</span>}
      </button>
    </div>
  </div>
));

SidebarContent.displayName = 'SidebarContent';

// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  );
  const location = useLocation();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const allMenuItems =
    user?.role === 'admin'
      ? [...menuItems, ...adminItems]
      : user?.subscriptionPlan === 'group_annual'
      ? [
          ...menuItems,
          { name: 'Team',       icon: Users2, href: '/team',       color: 'from-violet-400 to-purple-500' },
          { name: 'Enterprise', icon: Star,   href: '/enterprise', color: 'from-amber-400 to-orange-500' },
        ]
      : user?.subscriptionPlan?.startsWith('group')
      ? [...menuItems, { name: 'Team', icon: Users2, href: '/team', color: 'from-violet-400 to-purple-500' }]
      : menuItems;

  // Stable props derived from user (primitives only → memo equality works correctly)
  const userName      = user?.name      || 'Doctor';
  const userSpecialty = user?.specialty || 'Clinician';
  const userInitial   = user?.name?.charAt(0) || 'D';

  // Trial countdown
  const trialDaysLeft: number | null = (() => {
    if (user?.subscriptionStatus !== 'trial' || !user?.trialEndsAt) return null;
    const ms = new Date(user.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-base tracking-tight">Pronote</span>
              <span className="hidden sm:block text-emerald-400 text-xs -mt-0.5">AI Medical Scribe</span>
            </div>
          </Link>
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 28, stiffness: 250 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 shadow-2xl"
            >
          <SidebarContent
            collapsed={false}
            pathname={location.pathname}
            userName={userName}
            userSpecialty={userSpecialty}
            userInitial={userInitial}
            allMenuItems={allMenuItems}
            isCollapsed={false}
            trialDaysLeft={trialDaysLeft}
            onToggleCollapse={() => setIsCollapsed(v => !v)}
            onLogout={handleLogout}
          />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden lg:block fixed left-0 top-0 bottom-0 z-40 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden"
      >
        <SidebarContent
          collapsed={isCollapsed}
          pathname={location.pathname}
          userName={userName}
          userSpecialty={userSpecialty}
          userInitial={userInitial}
          allMenuItems={allMenuItems}
          isCollapsed={isCollapsed}
          trialDaysLeft={trialDaysLeft}
          onToggleCollapse={() => setIsCollapsed(v => !v)}
          onLogout={handleLogout}
        />
      </motion.aside>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: isDesktop ? (isCollapsed ? 72 : 256) : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 mt-16 lg:mt-0 min-h-screen w-full max-w-full overflow-x-hidden bg-[#080f14]"
      >
        {children}
      </motion.main>
    </div>
  );
}
