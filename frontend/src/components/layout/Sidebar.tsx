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
  Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', color: 'from-emerald-400 to-teal-500' },
  { name: 'Capture', icon: Mic, href: '/capture', color: 'from-rose-400 to-pink-500' },
  { name: 'Dictation', icon: MessageSquare, href: '/dictation', color: 'from-violet-400 to-purple-500' },
  { name: 'Upload', icon: Upload, href: '/upload', color: 'from-blue-400 to-indigo-500' },
  { name: 'Notes', icon: FileText, href: '/notes', color: 'from-amber-400 to-orange-500' },
  { name: 'Templates', icon: LayoutTemplate, href: '/templates', color: 'from-cyan-400 to-sky-500' },
  { name: 'Settings', icon: Settings, href: '/settings', color: 'from-slate-400 to-gray-500' },
];

const adminItems = [
  { name: 'Admin', icon: Users, href: '/admin', color: 'from-red-400 to-rose-500' },
];

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
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

  const allMenuItems = user?.role === 'admin'
    ? [...menuItems, ...adminItems]
    : user?.subscriptionPlan?.startsWith('group')
      ? [...menuItems, { name: 'Team', icon: Users2, href: '/team', color: 'from-violet-400 to-purple-500' }]
      : menuItems;

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`p-5 border-b border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="text-white font-bold text-lg tracking-tight">Pronote</span>
              <span className="block text-emerald-400 text-xs font-medium -mt-0.5">AI Medical Scribe</span>
            </motion.div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {allMenuItems.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
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
              <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                isActive
                  ? `bg-gradient-to-br ${item.color} shadow-lg`
                  : 'bg-white/5 group-hover:bg-white/10'
              }`}>
                <item.icon size={16} className={isActive ? 'text-white' : ''} />
              </div>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium text-sm relative z-10"
                >
                  {item.name}
                </motion.span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 relative z-10"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-white/10 space-y-2">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {user?.name?.charAt(0) || 'D'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name || 'Doctor'}</p>
              <p className="text-slate-400 text-xs truncate">{user?.specialty || 'Clinician'}</p>
            </div>
          </motion.div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <ChevronLeft size={18} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm font-medium">Sign out</span>}
        </button>
      </div>
    </div>
  );

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
              <SidebarContent collapsed={false} />
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
        <SidebarContent collapsed={isCollapsed} />
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
