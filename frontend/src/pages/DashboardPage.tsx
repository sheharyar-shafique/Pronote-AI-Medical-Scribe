import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Mic, 
  MessageSquare,
  Upload, 
  FileText, 
  Clock, 
  TrendingUp,
  Calendar,
  ChevronRight,
  Plus,
  LayoutTemplate
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Badge } from '../components/ui';
import { useAuthStore, useNotesStore } from '../store';
import { format } from 'date-fns';
import { dashboardApi, DashboardStats, Appointment } from '../services/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { notes, fetchNotes, isLoading } = useNotesStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch notes, stats, and appointments on mount
  useEffect(() => {
    fetchNotes();
    
    const fetchDashboardData = async () => {
      try {
        setStatsLoading(true);
        const [statsData, appointmentsData] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getAppointments(),
        ]);
        setStats(statsData);
        setAppointments(appointmentsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [fetchNotes]);

  const recentNotes = notes.slice(0, 5);

  const quickActions = [
    { 
      icon: <Mic size={24} />, 
      title: 'Capture Conversation', 
      description: 'Record a patient visit',
      href: '/capture',
      color: 'bg-emerald-500'
    },
    { 
      icon: <MessageSquare size={24} />, 
      title: 'Voice Dictation', 
      description: 'Dictate notes directly',
      href: '/dictation',
      color: 'bg-indigo-500'
    },
    { 
      icon: <Upload size={24} />, 
      title: 'Upload Audio', 
      description: 'Upload recorded audio',
      href: '/upload',
      color: 'bg-blue-500'
    },
    { 
      icon: <FileText size={24} />, 
      title: 'View Notes', 
      description: 'Browse all notes',
      href: '/notes',
      color: 'bg-purple-500'
    },
    { 
      icon: <LayoutTemplate size={24} />, 
      title: 'Templates', 
      description: 'Manage note templates',
      href: '/templates',
      color: 'bg-amber-500'
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'Doctor'}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your clinical documentation today.
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Notes', value: statsLoading ? '...' : (stats?.totalNotes?.toString() || '0'), icon: <FileText size={20} />, color: 'text-emerald-600' },
            { label: 'This Week', value: statsLoading ? '...' : (stats?.notesThisWeek?.toString() || '0'), icon: <Calendar size={20} />, color: 'text-blue-600' },
            { label: 'Avg. Time', value: statsLoading ? '...' : (stats?.averageTime || 'N/A'), icon: <Clock size={20} />, color: 'text-purple-600' },
            { label: 'Accuracy', value: statsLoading ? '...' : (stats?.accuracy || 'N/A'), icon: <TrendingUp size={20} />, color: 'text-amber-600' },
          ].map((stat, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={`${stat.color}`}>{stat.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-3 mb-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {quickActions.map((action, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Link to={action.href}>
                    <Card className="p-5 h-full" hover>
                      <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center text-white mb-4`}>
                        {action.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                      <p className="text-sm text-gray-500">{action.description}</p>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Today */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Today</h2>
            <Card className="p-5">
              <div className="space-y-4">
                {statsLoading ? (
                  <p className="text-gray-500 text-center py-4">Loading appointments...</p>
                ) : appointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No appointments scheduled for today</p>
                ) : (
                  appointments.map((appointment, index) => (
                    <div key={appointment.id || index} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="w-12 text-center">
                        <p className="text-sm font-medium text-gray-900">{appointment.time.split(' ')[0]}</p>
                        <p className="text-xs text-gray-500">{appointment.time.split(' ')[1]}</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{appointment.patient}</p>
                        <p className="text-sm text-gray-500">{appointment.type}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="ghost" className="w-full mt-4 text-emerald-600">
                View All Appointments
              </Button>
            </Card>
          </motion.div>
        </div>

        {/* Recent Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Clinical Notes</h2>
            <Link to="/notes" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1">
              View All <ChevronRight size={16} />
            </Link>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentNotes.map((note: any, index: number) => (
                    <motion.tr
                      key={note.id || index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-emerald-600 font-medium text-sm">
                              {note.patientName?.charAt(0) || 'P'}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{note.patientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(note.dateOfService), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 capitalize">{note.template}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={note.status === 'completed' ? 'success' : note.status === 'draft' ? 'warning' : 'info'}>
                          {note.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link to={`/notes/${note.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* New Note FAB (Mobile) */}
        <Link to="/capture" className="lg:hidden fixed bottom-6 right-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-colors"
          >
            <Plus size={24} />
          </motion.button>
        </Link>
      </div>
    </Sidebar>
  );
}
