import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Nav() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignInDropdown, setShowSignInDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check if there is a token in localStorage when the component mounts
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true); // Set to true if the token exists
    }
  }, []);

  const toggleSignInDropdown = () => {
    setShowSignInDropdown(!showSignInDropdown);
  };

  const closeDropdown = () => {
    setShowSignInDropdown(false);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Contact Us", path: "/Contact-Us" },
    { name: "Our Facilities", path: "/Our-Facilities" },
    { name: "About Us", path: "/About-Us" },
  ];

  return (
    <div className="w-full font-['Hanken_Grotesk']">
      {/* Upper Navigation Bar - Now Fixed */}
      <div className="fixed top-0 left-0 z-50 w-full shadow-md">
        <div className="w-full bg-[#2b2c6c]">
          <div className="mx-auto flex h-[50px] max-w-7xl items-center justify-between px-4">
            <div className="hidden items-center gap-6 text-white sm:flex">
              <Link
                to="/Find-doctor"
                className="text-sm font-semibold hover:text-[#28b6a2] transition-colors"
              >
                FIND A DOCTOR
              </Link>
              <Link
                to="/online-results"
                className="text-sm font-semibold hover:text-[#28b6a2] transition-colors"
              >
                ONLINE RESULTS
              </Link>
              <Link
                to="/Book-Appointment"
                className="text-sm font-semibold hover:text-[#28b6a2] transition-colors"
              >
                BOOK AN APPOINTMENT
              </Link>
            </div>

            <Link
              to="/request-consultation"
              className="ml-auto rounded-md bg-[#2FB297] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110"
            >
              REQUEST A CONSULTATION
            </Link>
          </div>
        </div>
      </div>

      {/* Space for Fixed Navbar - Prevent Content Overlap */}
      <div className="h-[50px]"></div>

      {/* Main Navigation Bar */}
      <div className="w-full border-b bg-white">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center cursor-pointer">
            <img
              src="/logo.png"
              alt="GoodPeople Medical Centre"
              className="h-[56px] w-auto"
            />
            <div className="ml-2 hidden text-[#2b2c6c] sm:block">
              <div className="font-bold text-base leading-tight">
                GoodPeople Medical Centre
              </div>
              <div className="text-xs">HEALTH AND WELLNESS CARE</div>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 font-semibold md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="relative py-2 text-black hover:text-pink-500 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-pink-500 after:transition-all after:duration-300 hover:after:w-full cursor-pointer"
              >
                {link.name}
              </Link>
            ))}
          
            {isAuthenticated ? (
              <>
                <Link
                  to="/Telemedicine"
                  className="relative py-2 text-black hover:text-pink-500 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-pink-500 after:transition-all after:duration-300 hover:after:w-full cursor-pointer"
                >
                  Telemedicine
                </Link>
                <Link
                  to="/User-Account"
                  className="relative py-2 text-black hover:text-pink-500 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-pink-500 after:transition-all after:duration-300 hover:after:w-full cursor-pointer"
                >
                  My Account
                </Link>
              </>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  className="relative flex items-center py-2 text-black hover:text-pink-500 after:absolute after:left-0 after:bottom-0 after:h-0.5 after:w-0 after:bg-pink-500 after:transition-all after:duration-300 hover:after:w-full cursor-pointer"
                  onClick={toggleSignInDropdown}
                >
                  <span>Sign In</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ml-1 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showSignInDropdown && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded border border-gray-200 bg-white shadow-lg">
                    <div className="py-2">
                      <Link
                        to="/login"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                        onClick={closeDropdown}
                      >
                        User Sign In
                      </Link>
                      <Link
                        to="/login-doctor"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                        onClick={closeDropdown}
                      >
                        Doctor Sign In
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-[#2b2c6c] hover:bg-gray-100 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={closeMobileMenu}
                    className="rounded px-3 py-2 font-semibold text-[#2b2c6c] hover:bg-gray-100"
                  >
                    {link.name}
                  </Link>
                ))}
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/Telemedicine"
                      onClick={closeMobileMenu}
                      className="rounded px-3 py-2 font-semibold text-[#2b2c6c] hover:bg-gray-100"
                    >
                      Telemedicine
                    </Link>
                    <Link
                      to="/User-Account"
                      onClick={closeMobileMenu}
                      className="rounded px-3 py-2 font-semibold text-[#2b2c6c] hover:bg-gray-100"
                    >
                      My Account
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={closeMobileMenu}
                      className="rounded px-3 py-2 font-semibold text-[#2b2c6c] hover:bg-gray-100"
                    >
                      User Sign In
                    </Link>
                    <Link
                      to="/login-doctor"
                      onClick={closeMobileMenu}
                      className="rounded px-3 py-2 font-semibold text-[#2b2c6c] hover:bg-gray-100"
                    >
                      Doctor Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Nav;
