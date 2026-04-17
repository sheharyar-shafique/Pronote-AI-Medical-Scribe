import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  FileText, 
  DollarSign,
  Search,
  MoreVertical,
  UserPlus,
  Ban,
  CheckCircle
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Badge, Input, Modal } from '../components/ui';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: string;
  notesCount: number;
  joinedAt: Date;
}

const mockUsers: User[] = [
  { id: '1', name: 'Dr. Sarah Johnson', email: 'sarah@example.com', role: 'clinician', status: 'active', plan: 'group_monthly', notesCount: 234, joinedAt: new Date('2024-01-15') },
  { id: '2', name: 'Dr. Michael Chen', email: 'michael@example.com', role: 'clinician', status: 'active', plan: 'individual_annual', notesCount: 156, joinedAt: new Date('2024-02-20') },
  { id: '3', name: 'Dr. Emily Davis', email: 'emily@example.com', role: 'clinician', status: 'inactive', plan: 'group_monthly', notesCount: 89, joinedAt: new Date('2024-03-10') },
  { id: '4', name: 'Dr. James Wilson', email: 'james@example.com', role: 'clinician', status: 'suspended', plan: 'individual_annual', notesCount: 12, joinedAt: new Date('2024-06-01') },
  { id: '5', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active', plan: 'group_annual', notesCount: 0, joinedAt: new Date('2024-01-01') },
];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const stats = [
    { label: 'Total Users', value: '1,234', icon: <Users size={20} />, change: '+12%' },
    { label: 'Active Subscriptions', value: '892', icon: <CheckCircle size={20} />, change: '+8%' },
    { label: 'Notes Generated', value: '45.2K', icon: <FileText size={20} />, change: '+24%' },
    { label: 'Monthly Revenue', value: '$78.5K', icon: <DollarSign size={20} />, change: '+15%' },
  ];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleStatusChange = (userId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
    toast.success(`User status updated to ${newStatus}`);
    setActiveMenu(null);
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">
              Manage users, subscriptions, and platform settings.
            </p>
          </div>
          <Button onClick={() => setShowUserModal(true)}>
            <UserPlus size={18} className="mr-2" />
            Add User
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat, index) => (
            <Card key={index} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-emerald-600">{stat.icon}</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </Card>
          ))}
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  aria-label="Filter by status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 * index }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-emerald-600 font-medium">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 capitalize">{user.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 capitalize">{user.plan}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{user.notesCount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={
                            user.status === 'active'
                              ? 'success'
                              : user.status === 'inactive'
                              ? 'warning'
                              : 'error'
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="More options"
                          >
                            <MoreVertical size={18} className="text-gray-500" />
                          </button>
                          {activeMenu === user.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-48 z-10"
                            >
                              <button
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
                                onClick={() => handleStatusChange(user.id, 'active')}
                              >
                                <CheckCircle size={16} className="text-emerald-500" />
                                Activate Account
                              </button>
                              <button
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
                                onClick={() => handleStatusChange(user.id, 'inactive')}
                              >
                                <Ban size={16} className="text-amber-500" />
                                Lock Account
                              </button>
                              <button
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
                                onClick={() => handleStatusChange(user.id, 'suspended')}
                              >
                                <Ban size={16} className="text-red-500" />
                                Suspend Account
                              </button>
                            </motion.div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Add User Modal */}
        <Modal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title="Add New User"
        >
          <div className="space-y-4">
            <Input label="Full Name" placeholder="Dr. John Doe" />
            <Input label="Email" type="email" placeholder="john@example.com" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select id="user-role" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  <option value="clinician">Clinician</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="user-plan" className="block text-sm font-medium text-gray-700 mb-1.5">Plan</label>
                <select id="user-plan" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                  <option value="individual_annual">Individual Annual</option>
                  <option value="group_monthly">Group Monthly</option>
                  <option value="group_annual">Group Annual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast.success('User invitation sent');
                setShowUserModal(false);
              }}>
                Send Invitation
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}
