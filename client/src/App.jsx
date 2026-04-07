import React from "react";  
import Navbar from "./Components/Navbar";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./Pages/Home";
import Products from "./Pages/Products";
import ProductDetail from "./Pages/ProductDetail";
import Cart from "./Pages/Cart";
import Checkout from "./Pages/Checkout";
import LoginModal from "./Components/LoginModal";
import MiniCartDrawer from "./Components/MiniCartDrawer";
import { useAppContext } from "./context/AppContext";
import { Toaster } from "react-hot-toast";
import SellerLayout from "./Pages/seller/sellerLayout";
import SellerDashboard from "./Pages/seller/SellerDashboard";
import Addproducts from "./Pages/seller/Addproducts";
import Productlist from "./Pages/seller/productlist";
import Orders from "./Pages/seller/Orders";
import MyOrders from "./Pages/MyOrders";
import Contact from "./Pages/Contact";
import Profile from "./Pages/Profile";
import PaymentSuccess from "./Pages/PaymentSuccess";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const PlaceholderPage = ({ title }) => (
  <div className="min-h-[60vh] flex items-center justify-center px-6">
    <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
  </div>
);

const App = () => {
  const location = useLocation();
  const issellerpath = location.pathname.includes("/seller");
  const { showLoginModal } = useAppContext();

  return (
    <div>
     <ScrollToTop />
     <Toaster position="top-right" />
     {showLoginModal && <LoginModal />}
     {issellerpath ? null : <Navbar />}
     {issellerpath ? null : <MiniCartDrawer />}
      <div>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<SellerDashboard />} />
            <Route path="dashboard" element={<SellerDashboard />} />
            <Route path="add-product" element={<Addproducts />} />
            <Route path="product-list" element={<Productlist />} />
            <Route path="orders" element={<Orders />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
};

export default App; 