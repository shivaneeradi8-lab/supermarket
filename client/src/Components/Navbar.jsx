import React from "react";  
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { assets } from "../assets/assets";
import { useAppContext } from "../context/AppContext";

const Navbar = () => { 
     const  [open, setOpen] = React.useState(false) 
    const [searchTerm, setSearchTerm] = React.useState("");
      const  { user, setUser, cart, setShowLoginModal } = useAppContext(); 
     const navigate = useNavigate();
     const location = useLocation();

     React.useEffect(() => {
          setOpen(false);
     }, [location.pathname]);

    const handleSearchSubmit = () => {
        const query = searchTerm.trim();
        const route = query ? `/products?search=${encodeURIComponent(query)}` : '/products';
        navigate(route);
        setOpen(false);
    };

    const handleSearchKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSearchSubmit();
        }
    };
     
     const logout = async () => {   
          setUser(null);
          setOpen(false);
          navigate('/');
     }

      return (
       <nav className="flex items-center justify-between px-6 md:px-16 lg:px-24 xl:px-32 py-4 border-b border-gray-300 bg-white relative transition-all">

            <NavLink to ='/'onClick={()=> setOpen(false)}>
                <img className="w-32" src={assets.logo} alt="Logo" />
            </NavLink>

            {/* Desktop Menu */}
            <div className="hidden sm:flex items-center gap-8">
			   <NavLink to="/">home</NavLink>
                <NavLink to="/products">All Products</NavLink>
                <NavLink to="/contact">Contact</NavLink>
                <NavLink to="/seller">Seller</NavLink>


                <div className="hidden lg:flex items-center text-sm gap-2 border border-gray-300 px-3 rounded-full">
                    <input
                        className="py-1.5 w-full bg-transparent outline-none placeholder-gray-500"
                        type="text"
                        placeholder="Search products"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    <button type="button" onClick={handleSearchSubmit} aria-label="Search products">
                        <img src={assets.search_icon} alt='Search' className='w-4 h-4'/>
                    </button>
                </div>

                <NavLink to="/cart" onClick={() => setOpen(false)} className="relative cursor-pointer" aria-label="Open cart">
                   <img src={assets.nav_cart_icon} alt='Cart' className='w-6 opacity-80'/>
                    <span className="absolute -top-2 -right-3 text-xs text-white bg-primary w-[18px] h-[18px] rounded-full flex items-center justify-center">{cart.length}</span>
                </NavLink>
               
               {!user ? ( <button onClick={()=>setShowLoginModal(true)} className="cursor-pointer px-8 py-2 bg-primary hover:bg-primary-dull transition text-white rounded-full">
                    Login
                </button> )
                :(
                    <div className='relative group'>
                        <img src={assets.profile_icon} className='w-10' alt="" />
                        <ul className='hidden group-hover:block absolute top-10 right-0 bg-white shadow border border-gray-200 py-2.5 w-30 rounded-md text-sm z-40'>
                            <li onClick={()=>navigate("/my-orders")} className="p-1.5 pl-3 hover:bg-primary/10 cursor-pointer">My Orders</li>
                            <li onClick={logout} className="p-1.5 pl-3 hover:bg-primary/10 cursor-pointer">Logout</li>
                        </ul>
                                            <ul className='hidden group-hover:block absolute top-10 right-0 bg-white shadow border border-gray-200 py-2.5 w-36 rounded-md text-sm z-40'>
                                                <li onClick={()=>navigate("/profile")} className="p-1.5 pl-3 hover:bg-primary/10 cursor-pointer">My Profile</li>
                                                <li onClick={()=>navigate("/my-orders")} className="p-1.5 pl-3 hover:bg-primary/10 cursor-pointer">My Orders</li>
                                                <li onClick={logout} className="p-1.5 pl-3 hover:bg-primary/10 cursor-pointer">Logout</li>
                                            </ul>
                    </div>
                )}
                
            </div>

            <button onClick={() => open ? setOpen(false) : setOpen(true)} aria-label="Menu" className="sm:hidden">
                {/* Menu Icon SVG */}
                <img src={assets.menu_icon} alt='menu'/> 
            </button>
                
             { open &&  (
            <div className={`${open ? 'flex' : 'hidden'} absolute top-[60px] left-0 w-full bg-white shadow-md py-4 flex-col items-start gap-2 px-5 text-sm md:hidden`}>
              <NavLink to="/"onClick={()=> setOpen(false)}>home</NavLink>
                            <NavLink to="/products"onClick={()=> setOpen(false)}>All Products</NavLink>
              <NavLink to="/seller"onClick={()=> setOpen(false)}>Seller</NavLink>
              <NavLink to="/cart" onClick={()=> setOpen(false)}>Cart ({cart.length})</NavLink>
              {user &&
              <NavLink to="/my-orders" onClick={()=> setOpen(false)}>My Orders</NavLink>  
}
                <NavLink to="/contact"onClick={()=> setOpen(false)}>Contact</NavLink>  

                 <div className="w-full flex items-center text-sm gap-2 border border-gray-300 px-3 rounded-full mt-2">
                    <input
                        className="py-1.5 w-full bg-transparent outline-none placeholder-gray-500"
                        type="text"
                        placeholder="Search products"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    <button type="button" onClick={handleSearchSubmit} aria-label="Search products">
                        <img src={assets.search_icon} alt='Search' className='w-4 h-4'/>
                    </button>
                </div>
                 {!user ? ( 
                
                        <button onClick={()=>{
                        setOpen(false);
                        setShowLoginModal(true); 
                        }} className="cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                    Login
                </button>
             ) : (
                 <button onClick={logout} className="cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                    Logout 
                </button> )}
               
            </div>
            )}

        </nav> 
    )
}
    
export default Navbar;