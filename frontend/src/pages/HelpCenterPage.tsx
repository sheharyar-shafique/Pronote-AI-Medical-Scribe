import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  ChevronRight,
  BookOpen,
  Layers,
  PenLine,
  Share2,
  Plus,
  Sliders,
  FileText,
  AlignLeft,
  List,
  Info,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Sidebar } from '../components/layout';

// ── Table of contents entries ─────────────────────────────────────────────────
const TOC = [
  { id: 'overview',         label: 'All Templates / My Templates' },
  { id: 'searching',        label: 'Searching for Templates' },
  { id: 'customizing',      label: 'How To Customize a Template' },
  { id: 'edit-existing',    label: 'Option 1: Edit an Existing Template' },
  { id: 'create-scratch',   label: 'Option 2: Create a Template from Scratch' },
  { id: 'sections',         label: 'Understanding Sections' },
  { id: 'sharing',          label: 'Sharing a Template' },
];

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState('overview');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Highlight active TOC item on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-20% 0% -70% 0%', threshold: 0 }
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Sidebar>
      <div className="relative min-h-screen">
        {/* BG glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">

          {/* ── Hero / Search header ── */}
          <div className="bg-gradient-to-br from-violet-600/30 via-purple-600/20 to-transparent border-b border-white/[0.08] px-5 sm:px-9 py-10">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <BookOpen size={17} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">Help Center</h1>
              </div>
              <p className="text-slate-400 text-sm mb-7">
                Everything you need to get the most out of Pronote AI Medical Scribe.
              </p>

              {/* Search bar */}
              <div className="relative max-w-xl mx-auto">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search for articles…"
                  className="w-full pl-11 pr-5 py-3.5 bg-white/[0.08] border border-white/[0.15] rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all text-sm"
                />
              </div>
            </motion.div>
          </div>

          {/* ── Body ── */}
          <div className="max-w-7xl mx-auto px-5 sm:px-9 py-8">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-slate-500 mb-8">
              <button onClick={() => navigate('/dashboard')} className="hover:text-slate-300 transition-colors">
                All Articles
              </button>
              <ChevronRight size={12} />
              <span className="text-slate-400">Using Pronote</span>
              <ChevronRight size={12} />
              <span className="text-white font-semibold">Template Library</span>
            </nav>

            <div className="flex gap-10 items-start">

              {/* ── Article content ── */}
              <article className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Template Library</h2>
                  <p className="text-slate-400 text-sm mb-1">
                    A dedicated hub where you can browse, create, and manage templates efficiently.
                  </p>
                  <p className="text-slate-600 text-xs mb-8">Updated recently</p>

                  {/* Platform availability callout */}
                  <div className="flex gap-3 p-4 bg-violet-500/10 border border-violet-500/25 rounded-xl mb-8">
                    <Info size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300 leading-relaxed">
                      <span className="font-semibold text-white">Platform Availability:</span> Web version only —
                      The Template Library is available on the web version of Pronote. To browse, create, or edit
                      templates, please use a desktop or laptop browser.
                    </p>
                  </div>

                  <hr className="border-white/[0.08] mb-8" />

                  {/* ── Section: Overview ── */}
                  <Section id="overview" icon={<Layers size={18} />} title="All Templates / My Templates">
                    <p>
                      The Template Library is accessible from the <strong>Templates</strong> link in the
                      left sidebar. Inside, you'll find two tabs:
                    </p>
                    <ul>
                      <li>
                        <strong>My Templates</strong> — templates you have added to your personal library.
                        These appear in the <em>Templates</em> dropdown when starting a new conversation or
                        recording session.
                      </li>
                      <li>
                        <strong>All Templates</strong> — the full catalog of built-in and custom templates
                        available on Pronote.
                      </li>
                    </ul>
                    <p>
                      To add a template to your library, click the <strong>+ Add</strong> button on any
                      template card. To remove it, click <strong>Remove</strong>. All built-in templates are
                      added by default when you first sign up.
                    </p>
                    <Callout type="tip">
                      Only templates in <strong>My Templates</strong> will appear in the recording screen
                      dropdown. Keep your list focused on the specialties you use most.
                    </Callout>
                  </Section>

                  {/* ── Section: Searching ── */}
                  <Section id="searching" icon={<Search size={18} />} title="Searching for Templates">
                    <p>
                      Use the <strong>Search</strong> bar at the top of the Template Library to filter
                      templates by name, specialty, or keyword. Results update instantly as you type.
                    </p>
                    <p>
                      You can also filter by <strong>specialty</strong> using the pill buttons below the
                      search bar (e.g., General, Psychiatry, Cardiology). Combining a specialty filter with
                      a keyword search quickly narrows down the right template.
                    </p>
                    <Steps>
                      <Step num={1}>Navigate to <strong>Templates</strong> in the sidebar.</Step>
                      <Step num={2}>Type a keyword (e.g., "SOAP", "progress", "pediatrics") in the search bar.</Step>
                      <Step num={3}>Optionally click a specialty pill to narrow results further.</Step>
                      <Step num={4}>Click <strong>+ Add</strong> on the template you want to use.</Step>
                    </Steps>
                  </Section>

                  {/* ── Section: Customizing ── */}
                  <Section id="customizing" icon={<PenLine size={18} />} title="How To Customize a Template">
                    <p>
                      Pronote gives you two ways to create a customized template — editing an existing one
                      or building from scratch. Both paths lead to the full <strong>Template Editor</strong>,
                      which lets you configure each section individually.
                    </p>
                    <Callout type="note">
                      Editing a built-in template always creates a <em>copy</em> — the original remains
                      available in the library unchanged.
                    </Callout>
                  </Section>

                  {/* ── Section: Edit existing ── */}
                  <Section id="edit-existing" icon={<PenLine size={18} />} title="Option 1: Edit an Existing Template">
                    <p>
                      Find any template in the library and click the <strong>Edit</strong> button on its card.
                      This opens the Template Editor pre-loaded with that template's sections.
                    </p>
                    <Steps>
                      <Step num={1}>Go to <strong>Templates</strong> → find the template you want to base yours on.</Step>
                      <Step num={2}>Click the <strong>Edit</strong> button on the template card.</Step>
                      <Step num={3}>
                        Update the <strong>Template Name</strong> at the top (it defaults to
                        "<em>Original Name</em> - Copy").
                      </Step>
                      <Step num={4}>
                        Adjust each section — change the title, verbosity, styling, and content instructions.
                      </Step>
                      <Step num={5}>Click <strong>Save Template</strong> to save your version.</Step>
                    </Steps>
                    <Callout type="tip">
                      You can reorder sections using the <strong>↑ ↓</strong> arrow buttons, or delete
                      sections you don't need with the <strong>trash</strong> icon.
                    </Callout>
                  </Section>

                  {/* ── Section: Create from scratch ── */}
                  <Section id="create-scratch" icon={<Plus size={18} />} title="Option 2: Create a Template from Scratch">
                    <p>
                      Click the <strong>+ Create New Template</strong> button in the top-right corner of
                      the Template Library. This opens a form where you can name your template, add a
                      description, and define its sections.
                    </p>
                    <Steps>
                      <Step num={1}>Click <strong>+ Create New Template</strong> in the Template Library header.</Step>
                      <Step num={2}>Enter a <strong>Template Name</strong> and optional description.</Step>
                      <Step num={3}>List section names (comma-separated) and choose a specialty.</Step>
                      <Step num={4}>Click <strong>Create Template</strong> — your template is saved and added to My Templates.</Step>
                    </Steps>
                    <Callout type="note">
                      Custom templates you create can be deleted at any time using the trash icon on their
                      card. Built-in templates cannot be deleted.
                    </Callout>
                  </Section>

                  {/* ── Section: Understanding Sections ── */}
                  <Section id="sections" icon={<Sliders size={18} />} title="Understanding Sections">
                    <p>
                      Each template is made up of one or more <strong>sections</strong>. When you open the
                      Template Editor, each section has its own card with the following controls:
                    </p>

                    <FieldRow
                      icon={<FileText size={14} />}
                      label="Section Title"
                      desc="The name displayed as a heading in the generated clinical note (e.g., Subjective, Assessment)."
                    />
                    <FieldRow
                      icon={<Sliders size={14} />}
                      label="Verbosity"
                      desc={
                        <>
                          Controls how much detail the AI generates.{' '}
                          <strong className="text-white">Concise</strong> produces shorter, focused outputs.{' '}
                          <strong className="text-white">Detailed</strong> produces comprehensive, thorough notes.
                        </>
                      }
                    />
                    <FieldRow
                      icon={<AlignLeft size={14} />}
                      label="Styling"
                      desc={
                        <>
                          <strong className="text-white">Paragraph</strong> generates flowing prose.{' '}
                          <strong className="text-white">Bullet points</strong> generates structured lists — useful
                          for sections like Objective or Plan.
                        </>
                      }
                    />
                    <FieldRow
                      icon={<FileText size={14} />}
                      label="Section Content"
                      desc="Instructions that tell the AI what to include in this section. Be specific — the clearer the instructions, the better the output."
                    />
                    <FieldRow
                      icon={<List size={14} />}
                      label="Optional Styling Instructions (Advanced)"
                      desc='Additional formatting rules, e.g., "Use numbered headings for each diagnosis." Expand Advanced Settings to access this field.'
                    />
                    <FieldRow
                      icon={<Layers size={14} />}
                      label='Include in "Copy all"'
                      desc='When enabled, this section is included when the clinician uses the "Copy all" action to copy the full note to clipboard. Disable for internal-only sections.'
                    />

                    <Callout type="tip">
                      After updating section content instructions, always test the template on a short
                      recording to verify the AI output matches your expectations.
                    </Callout>
                  </Section>

                  {/* ── Section: Sharing ── */}
                  <Section id="sharing" icon={<Share2 size={18} />} title="Sharing a Template">
                    <p>
                      You can quickly share a template's structure with a colleague using the{' '}
                      <strong>Share</strong> icon (↗) on any template card. This copies the template name
                      and section list to your clipboard, which you can paste into a message or email.
                    </p>
                    <Callout type="note">
                      Full template export and team-wide template sharing is available on the{' '}
                      <strong>Group</strong> subscription plans.
                    </Callout>

                    <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-start gap-3">
                      <ExternalLink size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300">
                        Need more help?{' '}
                        <button
                          onClick={() => navigate('/support')}
                          className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
                        >
                          Contact our support team
                        </button>{' '}
                        and we'll get back to you within one business day.
                      </p>
                    </div>
                  </Section>

                  {/* Back link */}
                  <div className="mt-10 pt-6 border-t border-white/[0.08]">
                    <button
                      onClick={() => navigate(-1)}
                      className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium group"
                    >
                      <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                      Back
                    </button>
                  </div>
                </motion.div>
              </article>

              {/* ── Table of Contents sidebar ── */}
              <aside className="hidden lg:block w-64 flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 }}
                  className="sticky top-8"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                    On this page
                  </p>
                  <nav className="space-y-1">
                    {TOC.map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => scrollTo(id)}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all ${
                          activeId === id
                            ? 'bg-violet-500/15 text-violet-300 border-l-2 border-violet-400 pl-[10px] font-semibold'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                </motion.div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}

// ── Reusable components ───────────────────────────────────────────────────────

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-8">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="prose-pronote space-y-3 text-slate-400 text-sm leading-relaxed pl-0">
        {children}
      </div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 my-3">{children}</ol>;
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-slate-400">
      <span className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {num}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function Callout({
  type,
  children,
}: {
  type: 'tip' | 'note' | 'warning';
  children: React.ReactNode;
}) {
  const styles = {
    tip: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    note: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  };
  const labels = { tip: '💡 Tip', note: 'ℹ️ Note', warning: '⚠️ Warning' };

  return (
    <div className={`my-4 p-4 border rounded-xl text-sm leading-relaxed ${styles[type]}`}>
      <span className="font-semibold mr-1">{labels[type]}:</span>
      {children}
    </div>
  );
}

function FieldRow({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-0.5">{label}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
