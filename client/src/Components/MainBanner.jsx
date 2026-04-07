import React from "react";  
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";

const MainBanner = () => {
    const navigate = useNavigate();

    return (
        <div className="relative w-full">   
            <img src={assets.main_banner_bg} alt="Main Banner" className="w-full hidden md:block" />
            <img src={assets.main_banner_bg_sm} alt="Main Banner" className="w-full md:hidden" />
            
            {/* Overlay Content */}
            <div className="absolute inset-0 flex items-center justify-start">
                <div className="px-6 md:px-16 lg:px-24 w-full md:w-1/2">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                        Fresh Groceries Delivered to Your Door
                    </h1>
                    <p className="text-base md:text-lg text-gray-700 mb-8 leading-relaxed">
                        Shop fresh groceries online and get them delivered within 20 min. Quality you can trust, prices you'll love.
                    </p>
                    <button
                        onClick={() => navigate("/products")}
                        className="inline-block px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full transition"
                    >
                        Shop Now
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MainBanner;