import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import FloatingChatButton from "@/components/FloatingChatButton";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Recommendations from "./pages/Recommendations";
import ScanQR from "./pages/ScanQR";
import Pharmacies from "./pages/Pharmacies";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";
import PharmacyRegister from "./pages/PharmacyRegister";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import PharmacyRegistrationPending from "./pages/PharmacyRegistrationPending";
import AdminPharmacies from "./pages/AdminPharmacies";
import PharmacyLogin from "./pages/PharmacyLogin";
import PharmacyOrders from "./pages/PharmacyOrders";
import PharmacyResetPassword from "./pages/PharmacyResetPassword";
import PharmacyUpdatePassword from "./pages/PharmacyUpdatePassword";
import PharmacyConnectorDownload from "./pages/PharmacyConnectorDownload";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import MyOrders from "./pages/MyOrders";
import PharmacyInvitation from "./pages/PharmacyInvitation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FloatingChatButton />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/scan-qr" element={<ScanQR />} />
            <Route path="/pharmacies" element={<Pharmacies />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/pharmacy-register" element={<PharmacyRegister />} />
            <Route path="/pharmacy-registration-pending" element={<PharmacyRegistrationPending />} />
            <Route path="/pharmacy-login" element={<PharmacyLogin />} />
            <Route path="/pharmacy-reset-password" element={<PharmacyResetPassword />} />
            <Route path="/pharmacy-update-password" element={<PharmacyUpdatePassword />} />
            <Route path="/pharmacy-dashboard" element={<PharmacyDashboard />} />
            <Route path="/pharmacy-invitation" element={<PharmacyInvitation />} />
            <Route path="/pharmacy-orders" element={<PharmacyOrders />} />
            <Route path="/pharmacy-connector-download" element={<PharmacyConnectorDownload />} />
            <Route path="/admin/pharmacies" element={<AdminPharmacies />} />
            <Route path="/checkout/:cartId" element={<Checkout />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/my-orders" element={<MyOrders />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
