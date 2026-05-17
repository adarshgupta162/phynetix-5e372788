import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  CheckCircle,
  Trophy,
  Users,
  Clock,
  Target,
  Zap,
  BookOpen,
  BarChart3,
  Shield,
  Star,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  FileText,
  Award,
  TrendingUp,
  MessageCircle,
  ChevronDown,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useState } from "react";
import { TestSeriesSection } from "@/components/landing/TestSeriesSection";

// Trust Stats
const trustStats = [
  {
    icon: Users,
    value: "50,000+",
    label: "Active Students",
  },
  {
    icon: Trophy,
    value: "95%",
    label: "Success Rate",
  },
  {
    icon: BookOpen,
    value: "10,000+",
    label: "Practice Questions",
  },
  {
    icon: Award,
    value: "4.9/5",
    label: "Average Rating",
  },
];

// Testimonials
const testimonials = [
  {
    name: "Rahul Sharma",
    rank: "AIR 245",
    exam: "JEE Main 2025",
    image: "👨‍🎓",
    text: "PhyNetix test series helped me identify my weak areas. The detailed analysis after each test was game-changing!",
    rating: 5,
  },
  {
    name: "Priya Patel",
    rank: "AIR 567",
    exam: "JEE Main 2025",
    image: "👩‍🎓",
    text: "Best test series I've used. The question quality matches exactly with JEE Main pattern. Highly recommended!",
    rating: 5,
  },
  {
    name: "Ankit Kumar",
    rank: "AIR 892",
    exam: "JEE Advanced 2025",
    image: "👨‍🎓",
    text: "The video solutions are crystal clear. I could understand concepts that I struggled with for months!",
    rating: 5,
  },
  {
    name: "Sneha Reddy",
    rank: "AIR 1,234",
    exam: "NEET 2025",
    image: "👩‍🎓",
    text: "PhyNetix made my preparation structured and efficient. The mock tests are as tough as the real exam!",
    rating: 5,
  },
];

// FAQ Data
const faqs = [
  {
    question: "What is PhyNetix Test Series?",
    answer: "PhyNetix Test Series is a comprehensive online platform offering high-quality mock tests for JEE Main, JEE Advanced, NEET, BITSAT, and MHT-CET. Our tests are designed by experts to match the exact pattern and difficulty level of actual exams.",
  },
  {
    question: "How are the tests structured?",
    answer: "Each test series includes full-length mock tests, chapter-wise tests, and previous year question papers. All tests come with detailed video and textual solutions, performance analytics, and personalized recommendations.",
  },
  {
    question: "Can I access tests on mobile devices?",
    answer: "Yes! Our platform is fully responsive and works seamlessly on all devices - desktop, tablet, and mobile. You can take tests anytime, anywhere.",
  },
  {
    question: "What kind of analysis do you provide?",
    answer: "We provide comprehensive analysis including section-wise performance, time management insights, accuracy metrics, comparison with top performers, and AI-powered recommendations for improvement.",
  },
  {
    question: "How often are new tests added?",
    answer: "We regularly update our test series with new mock tests and questions based on the latest exam patterns and trends. Subscribers get access to all new tests automatically.",
  },
  {
    question: "What if I need help during preparation?",
    answer: "We offer live doubt-solving sessions, dedicated support through chat and email, and an active community forum where you can interact with peers and mentors.",
  },
  {
    question: "Is there a refund policy?",
    answer: "Yes, we offer a 7-day money-back guarantee if you're not satisfied with our test series. Please refer to our refund policy page for detailed terms and conditions.",
  },
  {
    question: "How do I enroll in a test series?",
    answer: "Simply click on 'View Details' for your preferred test series, fill in your details, and complete the payment. You'll get instant access to all tests and features.",
  },
];

// Features
const features = [
  {
    icon: Target,
    title: "Exam Pattern Match",
    description: "Tests designed to exactly match the latest exam patterns and difficulty levels.",
  },
  {
    icon: BarChart3,
    title: "Detailed Analytics",
    description: "Get comprehensive performance insights with AI-powered recommendations.",
  },
  {
    icon: Clock,
    title: "Flexible Timing",
    description: "Take tests at your convenience with no time restrictions on attempts.",
  },
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Your data is safe with us. Enterprise-grade security for all transactions.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get immediate results and detailed solutions after test completion.",
  },
  {
    icon: MessageCircle,
    title: "Doubt Support",
    description: "Access to expert mentors for doubt resolution and guidance.",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="floating-orb w-96 h-96 bg-primary/30 top-20 -left-48" />
        <div className="floating-orb w-80 h-80 bg-accent/30 top-1/2 -right-40" style={{ animationDelay: '2s' }} />
        <div className="floating-orb w-72 h-72 bg-primary/20 bottom-20 left-1/3" style={{ animationDelay: '4s' }} />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-border/50 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display gradient-text">PhyNetix</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/courses" className="text-muted-foreground hover:text-foreground transition-colors">Courses</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/auth" className="hidden md:block">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/auth" className="hidden md:block">
              <Button>Get Started</Button>
            </Link>
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link to="/courses" className="text-muted-foreground hover:text-foreground transition-colors">Courses</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
              <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                <Link to="/auth">
                  <Button variant="outline" className="w-full">Login</Button>
                </Link>
                <Link to="/auth">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="mb-4 px-4 py-1.5 text-sm">
              <Sparkles className="w-3 h-3 mr-2" />
              India's Most Trusted Test Platform
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-display mb-6 gradient-text">
              Master Your Exam Preparation
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Comprehensive test series for JEE, NEET, BITSAT & more with AI-powered analytics,
              expert solutions, and personalized recommendations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/courses">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Explore Courses
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="relative z-10 py-12 border-y border-border/50 bg-muted/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {trustStats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <div className="text-3xl font-bold font-display gradient-text mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Test Series Section */}
      <TestSeriesSection />

      {/* Features Section */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 px-4 py-1.5 text-sm">
                <Zap className="w-3 h-3 mr-2" />
                Features
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 gradient-text">
                Why Choose PhyNetix?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to succeed in your exam preparation
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interface Preview Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 px-4 py-1.5 text-sm">
                <Target className="w-3 h-3 mr-2" />
                Interface
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 gradient-text">
                Modern & Intuitive Interface
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Experience a clean, distraction-free testing environment designed for optimal focus
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm p-8">
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-semibold">Clean Testing Interface</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Distraction-free environment for focused preparation
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 px-4 py-1.5 text-sm">
                <Star className="w-3 h-3 mr-2" />
                Testimonials
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 gradient-text">
                Success Stories
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Hear from students who achieved their dreams with PhyNetix
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl">{testimonial.image}</div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-primary">{testimonial.rank}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.exam}</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{testimonial.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="mb-4 px-4 py-1.5 text-sm">
                <MessageCircle className="w-3 h-3 mr-2" />
                FAQ
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold font-display mb-4 gradient-text">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Got questions? We've got answers
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-border/50 rounded-xl px-6 bg-card/50 backdrop-blur-sm"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-semibold">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Privacy & Terms Section */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <Shield className="w-8 h-8 text-primary mb-4" />
                <h3
