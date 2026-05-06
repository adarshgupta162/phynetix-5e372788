import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { StaffRolesProvider } from "@/hooks/useStaffRoles";
import AdminRoute from "@/components/AdminRoute";
import ProfileGuard from "@/components/ProfileGuard";
import LandingPage from "./pages/LandingPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CoursesPage from "./pages/CoursesPage";
import CoursePage from "./pages/CoursePage";
import PricingPage from "./pages/PricingPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import RefundPage from "./pages/RefundPage";
import AuthPage from "./pages/AuthPage";
import StaffAuthPage from "./pages/StaffAuthPage";
import Dashboard from "./pages/Dashboard";
import TestLibrary from "./pages/TestLibrary";
import PDFTestLibrary from "./pages/PDFTestLibrary";
import NormalTestInterface from "./pages/NormalTestInterface";
import PDFTestInterface from "./pages/PDFTestInterface";
import NormalTestAnalysis from "./pages/NormalTestAnalysis";
import DetailedAnalysis from "./pages/DetailedAnalysis";
import QuestionWiseAnalysis from "./pages/QuestionWiseAnalysis";
import MyAttempts from "./pages/MyAttempts";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import QuestionBankPage from "./pages/QuestionBankPage";
import AnalysisPage from "./pages/AnalysisPage";
import SolutionsPage from "./pages/SolutionsPage";
import TestSeriesEnrollment from "./pages/TestSeriesEnrollment";
// Batch pages
import BatchCatalogPage from "./pages/BatchCatalogPage";
import BatchDetailsPage from "./pages/BatchDetailsPage";
import MyBatchesPage from "./pages/MyBatchesPage";
import CheckoutPage from "./pages/CheckoutPage";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminQuestionBank from "./pages/admin/AdminQuestionBank";
import AdminTests from "./pages/admin/AdminTests";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import TestCreator from "./pages/admin/TestCreator";
import TestEditor from "./pages/admin/TestEditor";
import PDFTestList from "./pages/admin/PDFTestList";
import PDFTestCreate from "./pages/admin/PDFTestCreate";
import PDFTestEditor from "./pages/admin/PDFTestEditor";
import NormalTestAnalytics from "./pages/admin/NormalTestAnalytics";
import StaffCommunity from "./pages/admin/StaffCommunity";
import AuditLogs from "./pages/admin/AuditLogs";
import StaffRequests from "./pages/admin/StaffRequests";
import PhyNetixLibrary from "./pages/admin/PhyNetixLibrary";
import FullscreenTestEditor from "./pages/admin/FullscreenTestEditor";
import FinanceDashboard from "./pages/admin/FinanceDashboard";
import DPPManager from "./pages/admin/DPPManager";
import DPPEditor from "./pages/admin/DPPEditor";
import DPPPage from "./pages/DPPPage";
import DPPPractice from "./pages/DPPPractice";
import AcademicDashboard from "./pages/admin/AcademicDashboard";
import OperationsDashboard from "./pages/admin/OperationsDashboard";
import BatchManagement from "./pages/admin/BatchManagement";
import RoleSelectorPage from "./pages/admin/RoleSelectorPage";
import BulkImportPage from "./pages/admin/BulkImportPage";
import InstitutionsManager from "./pages/admin/InstitutionsManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StaffRolesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ProfileGuard>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                {/* Marketing/Pre-Login Pages */}
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/course/:courseId" element={<CoursePage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/refund" element={<RefundPage />} />
                {/* Test Series Enrollment */}
                <Route path="/enroll/:testSeriesId" element={<TestSeriesEnrollment />} />
                {/* Authentication Pages */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/signup" element={<AuthPage />} />
                <Route path="/staff-login" element={<StaffAuthPage />} />
                {/* Role Selector */}
                <Route path="/admin/select-role" element={<AdminRoute><RoleSelectorPage /></AdminRoute>} />
                {/* Student Dashboard & Features */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tests" element={<TestLibrary />} />
                <Route path="/pdf-tests" element={<PDFTestLibrary />} />
                <Route path="/question-bank" element={<QuestionBankPage />} />
                <Route path="/test/:testId" element={<NormalTestInterface />} />
                <Route path="/pdf-test/:testId" element={<PDFTestInterface />} />
                <Route path="/test/:testId/analysis" element={<AnalysisPage />} />
                <Route path="/pdf-test/:testId/analysis" element={<DetailedAnalysis />} />
                <Route path="/analysis/:testId" element={<AnalysisPage />} />
                <Route path="/solutions/:testId" element={<SolutionsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/attempts" element={<MyAttempts />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* DPP Routes */}
                <Route path="/dpps" element={<DPPPage />} />
                <Route path="/dpp/:dppId" element={<DPPPractice />} />
                {/* Batch Pages - Student */}
                <Route path="/batches" element={<BatchCatalogPage />} />
                <Route path="/batches/:batchId" element={<BatchDetailsPage />} />
                <Route path="/my-batches" element={<MyBatchesPage />} />
                <Route path="/checkout/:batchId" element={<CheckoutPage />} />
                {/* Admin Routes - All protected with AdminRoute */}
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/finance" element={<AdminRoute><FinanceDashboard /></AdminRoute>} />
                <Route path="/admin/academic" element={<AdminRoute><AcademicDashboard /></AdminRoute>} />
                <Route path="/admin/operations" element={<AdminRoute><OperationsDashboard /></AdminRoute>} />
                <Route path="/admin/batches" element={<AdminRoute><BatchManagement /></AdminRoute>} />
                <Route path="/admin/question-bank" element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
                <Route path="/admin/tests" element={<AdminRoute><AdminTests /></AdminRoute>} />
                <Route path="/admin/test-creator" element={<AdminRoute><TestCreator /></AdminRoute>} />
                <Route path="/admin/test-editor/:testId" element={<AdminRoute><TestEditor /></AdminRoute>} />
                <Route path="/admin/test-analytics/:testId" element={<AdminRoute><NormalTestAnalytics /></AdminRoute>} />
                <Route path="/admin/pdf-tests" element={<AdminRoute><PDFTestList /></AdminRoute>} />
                <Route path="/admin/pdf-tests/create" element={<AdminRoute><PDFTestCreate /></AdminRoute>} />
                <Route path="/admin/pdf-tests/:testId/edit" element={<AdminRoute><PDFTestEditor /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                <Route path="/admin/community" element={<AdminRoute><StaffCommunity /></AdminRoute>} />
                <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
                <Route path="/admin/requests" element={<AdminRoute><StaffRequests /></AdminRoute>} />
                <Route path="/admin/phynetix-library" element={<AdminRoute><PhyNetixLibrary /></AdminRoute>} />
                <Route path="/admin/dpps" element={<AdminRoute><DPPManager /></AdminRoute>} />
                <Route path="/admin/dpp-editor/:dppId" element={<AdminRoute><DPPEditor /></AdminRoute>} />
                <Route path="/admin/fullscreen-editor/:testId" element={<AdminRoute><FullscreenTestEditor /></AdminRoute>} />
                <Route path="/admin/bulk-import" element={<AdminRoute><BulkImportPage /></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProfileGuard>
          </BrowserRouter>
        </TooltipProvider>
      </StaffRolesProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
