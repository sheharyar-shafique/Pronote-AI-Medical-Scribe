import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  FileText,
  Calendar,
  MoreVertical,
  Trash2,
  Edit,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { Card, Button, Badge, Modal } from '../components/ui';
import { useNotesStore } from '../store';
import { templates } from '../data';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import toast from 'react-hot-toast';

export default function NotesPage() {
  const { notes, deleteNote, fetchNotes, isLoading, error } = useNotesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; noteId: string | null }>({
    isOpen: false,
    noteId: null,
  });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch notes on mount
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        // Search across multiple fields
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
          note.patientName?.toLowerCase().includes(searchLower) ||
          note.template?.toLowerCase().includes(searchLower) ||
          note.status?.toLowerCase().includes(searchLower) ||
          note.transcription?.toLowerCase().includes(searchLower);
        
        // Status filter
        const matchesStatus = filterStatus === 'all' || note.status === filterStatus;
        
        // Template filter
        const matchesTemplate = filterTemplate === 'all' || note.template === filterTemplate;
        
        // Date filter
        let matchesDate = true;
        if (filterDate !== 'all') {
          const noteDate = new Date(note.dateOfService);
          switch (filterDate) {
            case 'today':
              matchesDate = isToday(noteDate);
              break;
            case 'yesterday':
              matchesDate = isYesterday(noteDate);
              break;
            case 'week':
              matchesDate = isThisWeek(noteDate);
              break;
            case 'month':
              matchesDate = isThisMonth(noteDate);
              break;
          }
        }
        
        return matchesSearch && matchesStatus && matchesTemplate && matchesDate;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'date':
            comparison = new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
            break;
          case 'name':
            comparison = (a.patientName || '').localeCompare(b.patientName || '');
            break;
          case 'status':
            comparison = (a.status || '').localeCompare(b.status || '');
            break;
        }
        return sortOrder === 'asc' ? -comparison : comparison;
      });
  }, [notes, searchQuery, filterStatus, filterTemplate, filterDate, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => ({
    total: notes.length,
    draft: notes.filter(n => n.status === 'draft').length,
    completed: notes.filter(n => n.status === 'completed').length,
    signed: notes.filter(n => n.status === 'signed').length,
  }), [notes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotes();
    setIsRefreshing(false);
    toast.success('Notes refreshed');
  };

  const handleDelete = (id: string) => {
    deleteNote(id);
    setDeleteModal({ isOpen: false, noteId: null });
    toast.success('Note deleted successfully');
  };

  const handleExport = (note: typeof notes[0]) => {
    const content = `
Patient: ${note.patientName}
Date: ${format(new Date(note.dateOfService), 'MMMM d, yyyy')}
Template: ${note.template}
Status: ${note.status}

${note.transcription || 'No transcription available'}
    `.trim();
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.patientName?.replace(/\s+/g, '_') || 'note'}_${format(new Date(note.dateOfService), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Note exported');
    setActiveMenu(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle size={14} className="text-emerald-500" />;
      case 'completed':
        return <CheckCircle size={14} className="text-blue-500" />;
      case 'draft':
        return <Clock size={14} className="text-amber-500" />;
      default:
        return <AlertCircle size={14} className="text-gray-400" />;
    }
  };

  const formatRelativeDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  return (
    <Sidebar>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Clinical Notes</h1>
            <p className="text-gray-600">
              Manage and review all your clinical documentation.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hidden sm:flex"
            >
              <RefreshCw size={18} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/capture">
              <Button className="w-full sm:w-auto">
                <Plus size={18} className="mr-2" />
                New Note
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
        >
          <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('all')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Notes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText size={24} className="text-gray-400" />
            </div>
          </Card>
          <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('draft')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Drafts</p>
                <p className="text-2xl font-bold text-amber-600">{stats.draft}</p>
              </div>
              <Clock size={24} className="text-amber-400" />
            </div>
          </Card>
          <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('completed')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
              </div>
              <CheckCircle size={24} className="text-blue-400" />
            </div>
          </Card>
          <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus('signed')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Signed</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.signed}</p>
              </div>
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, template, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter size={18} />
              Filters
              <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Expandable Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        aria-label="Filter by status"
                      >
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="completed">Completed</option>
                        <option value="signed">Signed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                      <select
                        value={filterTemplate}
                        onChange={(e) => setFilterTemplate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        aria-label="Filter by template"
                      >
                        <option value="all">All Templates</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <select
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        aria-label="Filter by date"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                      <div className="flex gap-2">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'status')}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          aria-label="Sort by"
                        >
                          <option value="date">Date</option>
                          <option value="name">Patient Name</option>
                          <option value="status">Status</option>
                        </select>
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {(filterStatus !== 'all' || filterTemplate !== 'all' || filterDate !== 'all') && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Showing {filteredNotes.length} of {notes.length} notes
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterStatus('all');
                          setFilterTemplate('all');
                          setFilterDate('all');
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={32} className="animate-spin text-emerald-500" />
              <p className="text-gray-500">Loading notes...</p>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="p-6 border-red-200 bg-red-50">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-red-500" />
                <div>
                  <h3 className="font-medium text-red-700">Failed to load notes</h3>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
                <Button variant="outline" onClick={handleRefresh} className="ml-auto">
                  Try Again
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Notes Grid */}
        {!isLoading && !error && filteredNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notes found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? 'Try adjusting your search or filters' : 'Start by recording or uploading a conversation'}
              </p>
              <Link to="/capture">
                <Button>Create Your First Note</Button>
              </Link>
            </Card>
          </motion.div>
        ) : !isLoading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid gap-4"
          >
            {filteredNotes.map((note, index) => (
              <motion.div
                key={note.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.05 * index, 0.5) }}
                layout
              >
                <Card className="p-5 hover:shadow-md transition-all hover:border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        note.status === 'signed' 
                          ? 'bg-emerald-100' 
                          : note.status === 'completed'
                          ? 'bg-blue-100'
                          : 'bg-amber-100'
                      }`}>
                        <span className={`font-semibold text-lg ${
                          note.status === 'signed'
                            ? 'text-emerald-600'
                            : note.status === 'completed'
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        }`}>
                          {note.patientName?.charAt(0)?.toUpperCase() || 'P'}
                        </span>
                      </div>
                      <div>
                        <Link to={`/notes/${note.id}`}>
                          <h3 className="font-semibold text-gray-900 hover:text-emerald-600 transition-colors">
                            {note.patientName || 'Unknown Patient'}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatRelativeDate(new Date(note.dateOfService))}
                          </span>
                          <span className="capitalize flex items-center gap-1">
                            <FileText size={14} />
                            {note.template} Note
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(note.status)}
                        <Badge 
                          variant={
                            note.status === 'signed'
                              ? 'success' 
                              : note.status === 'completed' 
                              ? 'info' 
                              : 'warning'
                          }
                        >
                          {note.status}
                        </Badge>
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === note.id ? null : note.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="More options"
                        >
                          <MoreVertical size={18} className="text-gray-500" />
                        </button>
                        <AnimatePresence>
                          {activeMenu === note.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-40 z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                to={`/notes/${note.id}`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setActiveMenu(null)}
                              >
                                <Edit size={16} />
                                Edit Note
                              </Link>
                              <button
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
                                onClick={() => handleExport(note)}
                              >
                                <Download size={16} />
                                Export
                              </button>
                              <button
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                                onClick={() => {
                                  setDeleteModal({ isOpen: true, noteId: note.id });
                                  setActiveMenu(null);
                                }}
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, noteId: null })}
          title="Delete Note"
        >
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete this note? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, noteId: null })}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteModal.noteId && handleDelete(deleteModal.noteId)}
            >
              Delete
            </Button>
          </div>
        </Modal>
      </div>
    </Sidebar>
  );
}
