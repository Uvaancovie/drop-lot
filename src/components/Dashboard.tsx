import { useState, useMemo } from 'react';
import { Note, UserProfile } from '../types';
import { 
  FileText, Download, Trash2, Search, Filter, 
  Layers, CloudLightning, Shield, Database, Calendar, Clock, MapPin, 
  CheckCircle, RefreshCcw, Sparkles
} from 'lucide-react';

interface DashboardProps {
  notes: Note[];
  userProfile: UserProfile | null;
  onDeleteNote: (id: string) => void;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
  onSelectNote: (note: Note) => void;
}

export default function Dashboard({
  notes,
  userProfile,
  onDeleteNote,
  onSyncAll,
  isSyncing,
  onSelectNote
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [syncFilter, setSyncFilter] = useState('All');
  const [showPrintReport, setShowPrintReport] = useState(false);

  // Role Access guards
  const isAdmin = userProfile?.role === 'admin';

  // Filter and Search notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // 1. Text Search matches transcription or category or address
      const matchesSearch = 
        note.transcription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.address && note.address.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Category Filter
      const matchesCategory = categoryFilter === 'All' || note.category === categoryFilter;

      // 3. Sync status filter
      const matchesSync = 
        syncFilter === 'All' || 
        (syncFilter === 'Synced' && note.synced) || 
        (syncFilter === 'Offline' && !note.synced);

      return matchesSearch && matchesCategory && matchesSync;
    });
  }, [notes, searchQuery, categoryFilter, syncFilter]);

  // Derived Analytics
  const stats = useMemo(() => {
    const total = notes.length;
    const syncedCount = notes.filter(n => n.synced).length;
    const offlineCount = total - syncedCount;
    
    // Category Breakdown
    const categories: { [key: string]: number } = {};
    notes.forEach((n) => {
      categories[n.category] = (categories[n.category] || 0) + 1;
    });

    return {
      total,
      syncedCount,
      offlineCount,
      categories
    };
  }, [notes]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (notes.length === 0) return;

    // Headers
    const headers = ['Record ID', 'User ID', 'Latitude', 'Longitude', 'Category', 'Address', 'Voice Command', 'Transcription', 'Created At', 'Sync Status'];
    
    // Rows
    const rows = notes.map(note => [
      note.id,
      note.userId,
      note.latitude,
      note.longitude,
      `"${note.category.replace(/"/g, '""')}"`,
      `"${(note.address || '').replace(/"/g, '""')}"`,
      `"${(note.voiceCommand || '').replace(/"/g, '""')}"`,
      `"${note.transcription.replace(/"/g, '""')}"`,
      note.createdAt,
      note.synced ? 'Synced' : 'Local Queue'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Create file trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RADIR_Driving_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable layout for browser to PDF conversion
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Upper Grid: Bento Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">Total Logs</span>
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-3xl font-bold font-display text-slate-100 group-hover:scale-102 transition-transform origin-left">
              {stats.total}
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Driving entries recorded</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">Cloud Synced</span>
            <CheckCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="text-3xl font-bold font-display text-emerald-400 group-hover:scale-102 transition-transform origin-left">
              {stats.syncedCount}
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Safely persistent in Firestore</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">Offline Cache</span>
            <CloudLightning className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-3xl font-bold font-display text-amber-400 group-hover:scale-102 transition-transform origin-left">
              {stats.offlineCount}
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">Waiting for cellular service</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">Active Role</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-display text-slate-100 flex items-center gap-1.5 capitalize">
              <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              {userProfile?.role || 'driver'}
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              {isAdmin ? 'Full database admin access' : 'Driver tracking logs active'}
            </p>
          </div>
        </div>
      </div>

      {/* Database control panel & Filtering */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">Synchronized Drive Logs</h3>
            <p className="text-[10px] text-slate-500 font-mono">Filter, query, and manage recorded property coordinates</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSyncAll}
              disabled={isSyncing || stats.offlineCount === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                isSyncing 
                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                  : stats.offlineCount === 0
                    ? 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
              }`}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Offline Queue ({stats.offlineCount})
            </button>

            <button
              onClick={handleExportCSV}
              disabled={notes.length === 0}
              className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              onClick={() => setShowPrintReport(true)}
              disabled={notes.length === 0}
              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Generate PDF Report
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transcriptions, landmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="All">All Categories</option>
              <option value="Commercial">Commercial</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Tourism">Tourism</option>
              <option value="Safety">Safety</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <select
              value={syncFilter}
              onChange={(e) => setSyncFilter(e.target.value)}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="All">All Sync States</option>
              <option value="Synced">Synced Cloud</option>
              <option value="Offline">Offline Cache</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                <th className="px-4 py-3">Landmark/Address</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Audio/Transcription</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Sync</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500 font-mono">
                    No matching driving notes located in current logs database.
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => (
                  <tr 
                    key={note.id} 
                    className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectNote(note)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2 max-w-[200px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-slate-200 truncate">
                            {note.address || 'Driving Landmark'}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            {note.latitude.toFixed(4)}, {note.longitude.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-mono font-semibold ${
                        note.category === 'Commercial' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        note.category === 'Enterprise' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        note.category === 'Tourism' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {note.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="text-xs text-slate-300 leading-normal italic line-clamp-2">
                        "{note.transcription}"
                      </div>
                      {note.voiceCommand && (
                        <div className="text-[8px] font-mono text-sky-400/85 mt-1 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          Command: "{note.voiceCommand}"
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(note.createdAt).toLocaleDateString()}
                        <Clock className="w-3 h-3 ml-1" />
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${note.synced ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-[10px] font-mono text-slate-400">
                          {note.synced ? 'Synced' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* Delete access restricted by role or ownership */}
                      {(isAdmin || note.userId === userProfile?.uid) ? (
                        <button
                          onClick={() => onDeleteNote(note.id)}
                          className="p-1.5 bg-slate-950/40 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 border border-slate-800 rounded transition-all opacity-45 group-hover:opacity-100"
                          title="Delete drive record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-slate-700 ml-auto" title="Read Only Security Guard" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Enterprise Analytics (Visual bento box charts / stats) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sync Device Telemetry */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest">Device Sync Diagnostics</h4>
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <div className="space-y-3 font-mono text-[10px]">
            <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500">CLIENT RUNTIME:</span>
              <span className="text-slate-300">React 19 / Vite SPA</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500">OFFLINE SYNC ENGINES:</span>
              <span className="text-emerald-400">Firestore Persistence Enabled</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500">LOCAL INDEXED_DB BUFFER:</span>
              <span className="text-slate-300">{notes.filter(n => !n.synced).length} unsynced elements</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
              <span className="text-slate-500">ENCRYPTION ENGINE:</span>
              <span className="text-indigo-400">SSL / Firebase Auth Guard</span>
            </div>
          </div>
        </div>

        {/* Category breakdown visual bars */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest">Tag Category Distribution</h4>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="space-y-3.5">
            {['Commercial', 'Enterprise', 'Tourism', 'Safety'].map((cat) => {
              const count = stats.categories[cat] || 0;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const barColor = 
                cat === 'Commercial' ? 'bg-emerald-500' :
                cat === 'Enterprise' ? 'bg-amber-500' :
                cat === 'Tourism' ? 'bg-indigo-500' : 'bg-rose-500';

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-slate-500">{count} logs ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PDF / printable modal template screen */}
      {showPrintReport && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl p-8 max-w-4xl w-full border border-slate-200 shadow-2xl relative my-8 print:border-0 print:p-0 print:shadow-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="absolute top-4 right-4 flex gap-2 print:hidden">
              <button
                onClick={handlePrintPDF}
                className="px-4 py-1.5 bg-slate-950 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Trigger Browser Print/PDF
              </button>
              <button
                onClick={() => setShowPrintReport(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
              >
                Close Preview
              </button>
            </div>

            {/* Print Header */}
            <div className="border-b-2 border-slate-800 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">RADIR Driving Report</h1>
                  <p className="text-xs text-slate-500 font-mono mt-1">Location-Based Hands-Free Driving Intelligence</p>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-500">
                  <div>DATE: {new Date().toLocaleDateString()}</div>
                  <div>TIME: {new Date().toLocaleTimeString()}</div>
                  <div>GENERATOR: {userProfile?.displayName || userProfile?.email || 'Driver System'}</div>
                </div>
              </div>
            </div>

            {/* Print Overview Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6 border-b border-slate-200 pb-6">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[9px] font-mono uppercase text-slate-500">Total Driving Logs</span>
                <div className="text-xl font-bold mt-1 text-slate-800">{stats.total}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[9px] font-mono uppercase text-slate-500">Commercial Tagged</span>
                <div className="text-xl font-bold mt-1 text-emerald-600">{stats.categories['Commercial'] || 0}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[9px] font-mono uppercase text-slate-500">Enterprise Tagged</span>
                <div className="text-xl font-bold mt-1 text-amber-600">{stats.categories['Enterprise'] || 0}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[9px] font-mono uppercase text-slate-500">Safety Alerts</span>
                <div className="text-xl font-bold mt-1 text-rose-600">{stats.categories['Safety'] || 0}</div>
              </div>
            </div>

            {/* Print Logs List */}
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-3 font-mono">Detailed Driving Transcriptions</h2>
            <div className="space-y-4">
              {notes.map((note, index) => (
                <div key={note.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1">
                    <span>RECORD #{index + 1} - {note.category.toUpperCase()}</span>
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-800 italic font-medium">"{note.transcription}"</p>
                  <div className="text-[9px] text-slate-500 font-mono mt-1.5 flex gap-4">
                    <span>📍 GPS: {note.latitude.toFixed(4)}, {note.longitude.toFixed(4)}</span>
                    {note.address && <span className="truncate">🏠 PREMISES: {note.address}</span>}
                    {note.voiceCommand && <span>💬 COMMAND: {note.voiceCommand}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Print Footer */}
            <div className="border-t border-slate-200 mt-10 pt-6 text-center text-[9px] text-slate-400 font-mono">
              <p>RADIR Mobile Driving Assistant Platform. Encrypted & Synced with Firebase Cloud Architecture.</p>
              <p className="mt-1">CONFIDENTIAL DRIVER RECORDS REPORT - DO NOT DISTRIBUTE</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
