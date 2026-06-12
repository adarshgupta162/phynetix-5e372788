import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Target,
  Zap,
  BookOpen,
  BarChart3,
  Shield,
  Menu,
  X,
  Mail,
  Instagram,
  Linkedin,
  Youtube,
  Atom,
  GraduationCap,
  CheckCircle2,
  Users,
  ChevronRight,
  Brain,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState } from "react";
import { TestSeriesSection } from "@/components/landing/TestSeriesSection";

// ─── Data ──────────────────────────────────────────────────────────────────

// Real modules we've built — no inflation
const platformModules = [
  {
    icon: Target,
    label: "NTA-Exact CBT Interface",
    detail:
      "Pixel-accurate replica of the JEE Main interface — section navigation, question palette, MCQ / integer / multi-correct, marking scheme. No surprises on exam day.",
  },
  {
    icon: BookOpen,
    label: "Chapter-wise DPP System",
    detail:
      "Structured daily practice problems with admin-controlled unlock schedules, attempt tracking, and retry support.",
  },
  {
    icon: BarChart3,
    label: "Deep Performance Analytics",
    detail:
      "Section-wise accuracy, time-per-question heatmaps, percentile tracking within your batch, and attempt history.",
  },
  {
    icon: Atom,
    label: "Curated Question Bank",
    detail:
      "LaTeX-rendered questions reviewed by IIT & NIT qualifiers. Categorised by chapter, difficulty, and question type.",
  },
  {
    icon: Users,
    label: "Batch Management",
    detail:
      "Join your institute batch, follow scheduled test rollouts, and compare performance within your cohort.",
  },
  {
    icon: Shield,
    label: "Secure Test Environment",
    detail:
      "Fullscreen enforcement, tab-switch detection, event logs, and audit trails — keeping tests fair.",
  },
];

// Honest differentiators — things we can actually back up
const differentiators = [
  "Built by students who cleared JEE — we know exactly what's broken in existing platforms.",
  "NTA-identical interface means zero adjustment required on actual exam day.",
  "Questions reviewed by IIT & NIT qualifiers, not outsourced content farms.",
  "Analytics tell you where you lose marks, not just what your total score was.",
  "Institute admin panel — manage batches, DPPs, schedules, and student analytics.",
  "No inflated student counts or fake testimonials — we're being honest about being new.",
];

// Honest FAQs
const faqs = [
  {
    question: "Who built Phynetix?",
    answer:
      "Phynetix is built by a student team from IITs and NITs who cleared JEE themselves. We built it because we couldn't find a platform that truly matched the NTA interface or gave actionable analytics — so we made one.",
  },
  {
    question: "Is this a new platform?",
    answer:
      "Yes, we're in early access. The core engine is functional — CBT interface, DPP system, analytics, question bank, RBAC, and batch management are all live. We're onboarding our first cohort and iterating fast.",
  },
  {
    question: "Which exams does Phynetix cover?",
    answer:
      "JEE Main and JEE Advanced. That's our focus. We're going deep on one thing rather than spreading thin across ten exams.",
  },
  {
    question: "How accurate is the CBT interface compared to real JEE Main?",
    answer:
      "Designed to be as accurate as possible — section navigation, the question palette, question types (MCQ, integer, multi-correct), the timer, and the marking scheme all mirror the NTA interface.",
  },
  {
    question: "How are DPPs structured?",
    answer:
      "Each DPP is chapter-wise. Your batch admin sets an unlock schedule. You attempt, view solutions, and can retry. Every attempt is logged and tracked in your analytics.",
  },
  {
    question: "What does the analytics dashboard show?",
    answer:
      "Section-wise accuracy, time spent per question, question-level breakdown, attempt history, and batch-level comparisons. We're adding more based on feedback from early students.",
  },
  {
    question: "What about pricing?",
    answer:
      "Early access is free for our founding cohort. We believe the platform should prove its value before asking anyone to pay. Pricing will be transparent when we launch publicly.",
  },
  {
    question: "Can coaching institutes or schools use Phynetix?",
    answer:
      "Yes — we have a fully functional admin panel for batch creation, student management, DPP scheduling, test assignment, and performance monitoring. Reach out if you're interested in a demo.",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">

      {/* ── Background: subtle grid + one accent glow ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          top: "-240px",
          right: "-240px",
          width: "640px",
          height: "640px",
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.10) 0%, transparent 65%)",
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: "-200px",
          left: "-200px",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 65%)",
        }}
      />

      {/* ════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════ */}
      <header className="relative z-50 border-b border-border/40 backdrop-blur-xl sticky top-0 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Atom className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight gradient-text">Phynetix</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-7">
            {[
              ["Home", "/"],
              ["About", "/about"],
              ["Courses", "/courses"],
              ["Pricing", "/pricing"],
              ["Contact", "/contact"],
            ].map(([label, href]) => (
              <Link
                key={label}
                to={href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden md:block">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
            <Link to="/auth" className="hidden md:block">
              <Button size="sm">Register</Button>
            </Link>
            <button
              className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {[
                ["Home", "/"],
                ["About", "/about"],
                ["Courses", "/courses"],
                ["Pricing", "/pricing"],
                ["Contact", "/contact"],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  to={href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-border/40">
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="w-full">
                    Login
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="w-full">
                    Sign Up
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="relative z-10 pt-24 pb-20 md:pt-36 md:pb-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="max-w-3xl mx-auto text-center"
          >
            {/* Honest identity badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs text-primary font-medium mb-7 tracking-wide">
              <GraduationCap className="w-3.5 h-3.5" />
              Built by JEE qualifiers from IITs &amp; NITs · Early Access
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.06]">
              <span className="gradient-text">Prepare smarter.</span>
              <br />
              <span className="text-foreground">Score higher.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
              A serious JEE preparation platform — NTA-exact test interface, structured DPPs,
              deep performance analytics, and a curated question bank. Built by people who
              cleared JEE, for people who will.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 px-8 text-base">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/courses">
                <Button size="lg" variant="outline" className="px-8 text-base">
                  Explore Platform
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Honest credibility strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="mt-14 flex flex-wrap justify-center items-center gap-x-8 gap-y-3"
          >
            {[
              "NTA-exact CBT interface",
              "JEE Main & Advanced",
              "Chapter-wise DPP system",
              "Real-time analytics",
              "No fake stats",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          WHAT WE'VE ACTUALLY BUILT
      ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 border-y border-border/30 bg-muted/15">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              The Platform
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What's actually built
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-relaxed">
              Not a mockup. Not wireframes. Six core modules functional and live.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {platformModules.map((mod, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="group p-5 rounded-xl border border-border/40 bg-card/25 hover:border-primary/40 hover:bg-card/50 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <mod.icon
                      style={{ width: "17px", height: "17px" }}
                      className="text-primary"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-1.5">
                      {mod.label}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {mod.detail}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          TEST SERIES (existing dynamic section)
      ════════════════════════════════════════════ */}
      <TestSeriesSection />

      {/* ════════════════════════════════════════════
          WHY WE'RE DIFFERENT
      ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">

            {/* Left — story */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
                Why Phynetix
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5 leading-tight">
                Built by aspirants,<br />for aspirants.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                We're a student team from IITs and NITs. We used every major test platform
                during our JEE prep — and found the same problems everywhere: generic
                interfaces nothing like the actual NTA format, analytics that only show
                your score, questions recycled from outdated books.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                So we built the platform we actually wanted. No VC money, no marketing
                fluff — just engineers and JEE qualifiers building something real.
              </p>
              <Link to="/about">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Our story{" "}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </motion.div>

            {/* Right — differentiator list */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-2.5"
            >
              {differentiators.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-lg border border-border/30 bg-card/20 hover:bg-card/40 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {point}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          INTERFACE PREVIEW (placeholder — swap with actual screenshot)
      ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 border-y border-border/30 bg-muted/15">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              Interface
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Familiar on day one
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-relaxed">
              The test interface is identical to NTA JEE Main — so when the real exam
              comes, you're already comfortable.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            {/* Replace this div with an actual screenshot of your CBT interface */}
            {/* CBT Interface with fallback */}
<div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl">
  {(!imgLoaded || imgError) && (
    <div className="rounded-xl border border-border/40 bg-card/30 aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Brain style={{ width: "40px", height: "40px" }} className="text-primary/40" />
      <p className="text-sm font-medium">CBT Interface Preview</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
        NTA-exact test interface with section tabs and question palette
      </p>
    </div>
  )}
  {!imgError && (
    <img
      src="cbt-preview.png"
      alt="Phynetix CBT Interface"
      className="w-full h-auto block"
      style={{ display: imgLoaded ? "block" : "none" }}
      onLoad={() => setImgLoaded(true)}
      onError={() => setImgError(true)}
      draggable={false}
    />
  )}
</div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FAQ
      ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Honest answers
            </h2>
            <p className="text-muted-foreground mt-3 max-w-sm mx-auto text-sm">
              We're a new startup. Here's what you actually want to know.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border/40 rounded-xl px-5 bg-card/25"
                >
                  <AccordionTrigger className="text-left hover:no-underline text-sm font-medium py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA — Early Access
      ════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 border-t border-border/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <div
              className="p-10 md:p-14 rounded-2xl border border-primary/20"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.09) 0%, transparent 70%)",
              }}
            >
              <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                Founding Cohort
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Be among our first students
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-md mx-auto">
                We're onboarding our founding cohort now. Get Started, help shape the
                platform, and prepare for JEE with a tool built by people who've been exactly
                where you are. Free for the founding batch.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/auth">
                  <Button size="lg" className="gap-2 px-8">
                    Join Now — It's Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="px-8">
                    Talk to us
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-border/30 bg-muted/20">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

            {/* Brand */}
            <div>
              <Link to="/" className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Atom className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold tracking-tight gradient-text">Phynetix</span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-4">
                A JEE preparation platform built by students from IITs and NITs.
                Currently in early access.
              </p>
              <div className="flex gap-2">
                {[Instagram, Linkedin, Youtube].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-8 h-8 rounded-lg border border-border/40 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Icon style={{ width: "14px", height: "14px" }} className="text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Platform
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    ["About", "/about"],
                    ["Courses", "/courses"],
                    ["Pricing", "/pricing"],
                    ["Contact", "/contact"],
                  ].map(([label, href]) => (
                    <li key={label}>
                      <Link
                        to={href}
                        className="hover:text-foreground transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Legal
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    ["Privacy Policy", "/privacy"],
                    ["Terms of Service", "/terms"],
                    ["Refund Policy", "/refund"],
                  ].map(([label, href]) => (
                    <li key={label}>
                      <Link
                        to={href}
                        className="hover:text-foreground transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Contact */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Contact
              </div>
              <a
                href="mailto:hello@phynetix.in"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail style={{ width: "14px", height: "14px" }} />
                hello@phynetix.in
              </a>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                We're students. Response time might be a few hours — we
                appreciate your patience.
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© 2026 Phynetix. All rights reserved.</p>
            <p className="text-muted-foreground/60">
              Made with focus, by JEE qualifiers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
