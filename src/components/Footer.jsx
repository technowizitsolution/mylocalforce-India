import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import React from 'react'

const Footer = () => {
    const socialLinks = [
        {
            icon: <FaXTwitter />,
            url: "https://twitter.com",
            hover: "hover:bg-black hover:text-white",
        },
        {
            icon: <FaFacebookF />,
            url: "https://facebook.com",
            hover: "hover:bg-[#1877F2] hover:text-white",
        },
        {
            icon: <FaInstagram />,
            url: "https://instagram.com",
            hover:
                "hover:text-white hover:bg-gradient-to-tr hover:from-pink-500 hover:via-red-500 hover:to-yellow-500",
        },
        {
            icon: <FaLinkedinIn />,
            url: "https://linkedin.com",
            hover: "hover:bg-[#0A66C2] hover:text-white",
        },
    ];
    return (
        <footer className="bg-gray-100 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
            <div className="mx-auto max-w-7xl">
                {/* Logo Section */}
                <div className="mb-6 sm:mb-8 md:mb-12 flex items-center gap-2 sm:gap-3">
                    <img src="/images/MLF.jpg" alt="Logo" className="h-8 w-8 sm:h-10 sm:w-10 rounded" />
                    <span className="font-extrabold text-black text-sm sm:text-base md:text-lg">MY LOCAL FORCE</span>
                </div>

                {/* Footer Content */}
                <div className="mb-6 sm:mb-8 md:mb-12 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
                    {/* Company Column */}
                    <div>
                        <h3 className="mb-3 sm:mb-4 md:mb-6 font-bold text-gray-900 text-sm sm:text-base">Company</h3>
                        <ul className="space-y-2 sm:space-y-3">
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">About us</a></li>
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Terms & conditions</a></li>
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Privacy policy</a></li>
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Careers</a></li>
                        </ul>
                    </div>

                    {/* For Customers Column */}
                    <div>
                        <h3 className="mb-3 sm:mb-4 md:mb-6 font-bold text-gray-900 text-sm sm:text-base">For customers</h3>
                        <ul className="space-y-2 sm:space-y-3">
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">MLF reviews</a></li>
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Categories near you</a></li>
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Contact us</a></li>
                        </ul>
                    </div>

                    {/* For Professionals Column */}
                    <div className="col-span-2 sm:col-span-1">
                        <h3 className="mb-3 sm:mb-4 md:mb-6 font-bold text-gray-900 text-sm sm:text-base">For professionals</h3>
                        <ul className="space-y-2 sm:space-y-3">
                            <li><a href="#" className="text-xs sm:text-sm text-gray-700 hover:text-gray-900 transition">Register as a professional</a></li>
                        </ul>
                    </div>

                    {/* Social Links & Apps Column */}
                    <div className="col-span-2 sm:col-span-1">
                        <h3 className="mb-3 sm:mb-4 md:mb-5 font-semibold text-gray-900 text-sm sm:text-base md:text-lg">
                            Social links
                        </h3>

                        {/* Social Icons Row */}
                        <div className="flex items-center gap-3 sm:gap-4 md:gap-5 mb-6 md:mb-8">
                            {socialLinks.map((item, i) => (
                                <a
                                    key={i}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`
            group
            flex h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12
            items-center justify-center
            rounded-full
            border border-gray-200
            bg-white
            text-gray-700
            shadow-sm
            transition-all duration-300 ease-out
            hover:-translate-y-1 hover:shadow-lg
            ${item.hover}
          `}
                                >
                                    <span className="text-base md:text-lg transition-transform duration-300 group-hover:scale-110">
                                        {item.icon}
                                    </span>
                                </a>
                            ))}
                        </div>

                        {/* App Download Buttons */}
                        <div className="flex flex-row sm:flex-col gap-2 sm:gap-3 md:gap-4">
                            <a
                                href="https://apps.apple.com/in/app/mylocalforce/id6757386095"
                                className="inline-block transition-transform duration-300 hover:scale-105"
                            >
                                <img
                                    src="/images/appStore.webp"
                                    alt="Download on App Store"
                                    className="h-7 sm:h-8 md:h-10 w-auto object-contain"
                                />
                            </a>

                            <a
                                href="https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share"
                                className="inline-block transition-transform duration-300 hover:scale-105"
                            >
                                <img
                                    src="/images/googlePlay.webp"
                                    alt="Get it on Google Play"
                                    className="h-7 sm:h-8 md:h-10 w-auto object-contain"
                                />
                            </a>
                        </div>

                    </div>
                </div>

                {/* Divider */}
                <div className="mb-4 sm:mb-6 md:mb-8 border-t border-gray-300"></div>

                {/* Copyright */}
                <div className="text-[10px] sm:text-xs text-gray-600">

                    <p className="leading-relaxed">© 2025 MyLocalForce. All rights reserved. | Designed by Technowiz IT Solutions</p>
                </div>
            </div>
        </footer>
    )
}

export default Footer