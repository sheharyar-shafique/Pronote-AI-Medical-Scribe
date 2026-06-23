import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle,
  Plus,
  Search,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
} from 'lucide-react';
import { Sidebar } from '../components/layout';
import { useNotesStore } from '../store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ClinicalNote } from '../types';

// ── Patient row aggregation ─────────────────────────────────────────────────
interface PatientRow {
  name: string;
  noteCount: number;
  lastNoteAt: number | null; // epoch ms; null if no notes
}

const PATIENT_LIST_KEY = 'pronote_patient_list_extra';

// Patients added explicitly via "+ New Patient" — these may not have any notes yet,
// so we keep them in localStorage so the list shows them even without recordings.
function loadExtraPatients(): string[] {
  try {
    const raw = localStorage.getItem(PATIENT_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function saveExtraPatients(names: string[]) {
  try {
    localStorage.setItem(PATIENT_LIST_KEY, JSON.stringify(names));
  } catch {}
}

function patientStorageSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_');
}

// Wipe all patient-scoped localStorage keys when a patient is deleted.
function purgePatientLocalState(name: string) {
  const slug = patientStorageSlug(name);
  const keys = [
    `pronote_patient_${slug}`,
    `pronote_patient_context_${slug}`,
    `pronote_patient_treatment_plan_${slug}`,
    `pronote_patient_reports_${slug}`,
  ];
  for (const k of keys) {
    try { localStorage.removeItem(k); } catch {}
  }
}

function aggregatePatients(notes: ClinicalNote[], extra: string[]): PatientRow[] {
  const map = new Map<string, PatientRow>();

  for (const note of notes) {
    const name = (note.patientName || '').trim();
    if (!name) continue;
    const ts = new Date(note.createdAt).getTime();
    const existing = map.get(name);
    if (existing) {
      existing.noteCount += 1;
      if (ts > (existing.lastNoteAt ?? 0)) existing.lastNoteAt = ts;
    } else {
      map.set(name, { name, noteCount: 1, lastNoteAt: ts });
    }
  }

  // Add manually-added patients that don't yet have notes.
  for (const name of extra) {
    if (!map.has(name)) {
      map.set(name, { name, noteCount: 0, lastNoteAt: null });
    }
  }

  return Array.from(map.values());
}

// ── Page ────────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'count' | 'last';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 10;

export default function PatientsListPage() {
  const navigate = useNavigate();
  const { notes } = useNotesStore();

  const [extraPatients, setExtraPatients] = useState<string[]>(() => loadExtraPatients());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('last');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [showRowActions, setShowRowActions] = useState(false);

  // Re-read from localStorage when the tab becomes visible again (covers profile
  // tweaks the user made on a Patient page in another tab).
  useEffect(() => {
    const handler = () => setExtraPatients(loadExtraPatients());
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const allPatients = useMemo(
    () => aggregatePatients(notes, extraPatients),
    [notes, extraPatients]
  );

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allPatients.filter(p => p.name.toLowerCase().includes(q))
      : allPatients;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'count') {
        cmp = a.noteCount - b.noteCount;
      } else {
        cmp = (a.lastNoteAt ?? 0) - (b.lastNoteAt ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allPatients, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filteredAndSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredAndSorted, safePage]
  );

  const allOnPageSelected = paged.length > 0 && paged.every(p => selectedNames.has(p.name));
  const someOnPageSelected = paged.some(p => selectedNames.has(p.name));

  const togglePage = () => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach(p => next.delete(p.name));
      else paged.forEach(p => next.add(p.name));
      return next;
    });
  };

  const toggleRow = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Sensible defaults: names ascend, counts/dates descend.
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const handleAddPatient = () => {
    const name = newPatientName.trim();
    if (!name) {
      toast.error('Patient name is required.');
      return;
    }
    if (allPatients.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A patient with that name already exists.');
      return;
    }
    const next = [...extraPatients, name];
    saveExtraPatients(next);
    setExtraPatients(next);
    setShowAddModal(false);
    setNewPatientName('');
    toast.success(`${name} added`);
  };

  const handleDeleteSelected = () => {
    if (selectedNames.size === 0) return;
    const count = selectedNames.size;
    if (!confirm(
      `Delete ${count} patient${count === 1 ? '' : 's'}?\n\n` +
      `This clears their saved profile, context, treatment plan, and reports on this device. ` +
      `Existing notes are NOT deleted; the patient name will reappear in this list as long as a note for them exists.`
    )) {
      return;
    }
    selectedNames.forEach(name => purgePatientLocalState(name));
    const remaining = extraPatients.filter(n => !selectedNames.has(n));
    saveExtraPatients(remaining);
    setExtraPatients(remaining);
    setSelectedNames(new Set());
    toast.success(`${count} patient${count === 1 ? '' : 's'} deleted`);
  };

  const SortHeader = ({ label, k, width }: { label: string; k: SortKey; width?: string }) => {
    const active = sortKey === k;
    return (
      <th className={`px-6 py-3.5 font-semibold text-slate-300 ${width ?? ''}`}>
        <button
          onClick={() => cycleSort(k)}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          {active && (sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
          {label}
        </button>
      </th>
    );
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* Background glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 lg:p-9 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-400 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
              <UserCircle size={18} className="text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Patients</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/[0.1] text-slate-400 text-xs font-semibold">
              {allPatients.length} total
            </span>
          </motion.div>
          <p className="text-slate-400 ml-12 text-sm mb-6">
            Everyone who has been documented in your account.
          </p>

          {/* Toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5"
          >
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search Patient"
                className="w-full pl-10 pr-4 py-2.5 border border-white/[0.1] rounded-xl bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 focus:border-fuchsia-400/40 transition-all text-sm"
              />
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-fuchsia-500/25 whitespace-nowrap"
              >
                <Plus size={15} />
                New Patient
              </motion.button>

              <button
                onClick={handleDeleteSelected}
                disabled={selectedNames.size === 0}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-500/40 text-red-400 rounded-xl hover:bg-red-500/10 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:border-white/[0.1] disabled:text-slate-500 whitespace-nowrap"
              >
                <Trash2 size={15} />
                Delete patients
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowRowActions(v => !v)}
                  className="p-2.5 border border-white/[0.1] text-slate-300 rounded-xl hover:bg-white/[0.06] transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontal size={15} />
                </button>
                <AnimatePresence>
                  {showRowActions && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowRowActions(false)}
                      />
                      <motion.ul
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute right-0 top-full mt-1 z-40 bg-slate-800 border border-white/[0.1] rounded-xl overflow-hidden shadow-xl min-w-[180px]"
                      >
                        <li>
                          <button
                            onClick={() => {
                              setShowRowActions(false);
                              setSelectedNames(new Set(allPatients.map(p => p.name)));
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            Select all patients
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => {
                              setShowRowActions(false);
                              setSelectedNames(new Set());
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            Clear selection
                          </button>
                        </li>
                      </motion.ul>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="w-12 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        ref={el => {
                          if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                        }}
                        onChange={togglePage}
                        className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-fuchsia-500 cursor-pointer"
                      />
                    </th>
                    <SortHeader label="Patient" k="name" />
                    <SortHeader label="Number of notes" k="count" width="w-48" />
                    <SortHeader label="Last note" k="last" width="w-64" />
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-500 text-sm">
                        {search
                          ? 'No patients match your search.'
                          : 'No patients yet. Click "New Patient" to add one or record a note from the Capture page.'}
                      </td>
                    </tr>
                  ) : (
                    paged.map((p, i) => {
                      const checked = selectedNames.has(p.name);
                      return (
                        <tr
                          key={p.name}
                          onClick={() => navigate(`/patients/${encodeURIComponent(p.name)}`)}
                          className={`border-b border-white/[0.05] cursor-pointer transition-colors ${
                            checked ? 'bg-fuchsia-500/[0.06]' : 'hover:bg-white/[0.04]'
                          } ${i === paged.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(p.name)}
                              className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-fuchsia-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 text-white font-medium">{p.name}</td>
                          <td className="px-6 py-4 text-slate-400">{p.noteCount}</td>
                          <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                            {p.lastNoteAt
                              ? format(new Date(p.lastNoteAt), 'MMM d, yyyy, h:mm a')
                              : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08] bg-white/[0.02]">
              <span className="text-xs text-slate-400">
                {selectedNames.size} of {filteredAndSorted.length} row{filteredAndSorted.length === 1 ? '' : 's'} selected.
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-md border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-md border border-white/[0.1] text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Add Patient modal */}
          <AnimatePresence>
            {showAddModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowAddModal(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 20 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md bg-slate-900 border border-white/[0.1] rounded-2xl p-6 shadow-2xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">New Patient</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        You can flesh out the profile after creating.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Patient name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newPatientName}
                    onChange={e => setNewPatientName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddPatient();
                    }}
                    placeholder="e.g., Alex Johnson"
                    className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.12] rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/40 transition-all text-sm"
                  />

                  <div className="flex justify-end gap-3 mt-5">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2.5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 font-semibold text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleAddPatient}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-all"
                    >
                      <Plus size={15} />
                      Create
                    </motion.button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Sidebar>
  );
}
