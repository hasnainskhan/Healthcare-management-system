import React from "react";
import { Link } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";

function Footer() {
  return (
    <footer className="w-full bg-[#2b2c6c]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Logo */}
          <div className="flex items-center justify-center sm:justify-start">
            <img
              className="h-[52px] w-auto object-contain opacity-95"
              src="/logo.png"
              alt="GoodPeople Medical Centre"
            />
          </div>

          {/* Social Icons */}
          <div className="flex justify-center gap-5 text-white">
            <i className="fa-brands fa-facebook text-3xl"></i>
            <i className="fa-brands fa-whatsapp text-3xl"></i>
            <i className="fa-brands fa-twitter text-3xl"></i>
            <i className="fa-brands fa-instagram text-3xl"></i>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-white">
          <Link to="/About-Us" className="text-sm font-medium hover:underline">
            About Us
          </Link>
          <Link to="/Contact-Us" className="text-sm font-medium hover:underline">
            Contact Us
          </Link>
          <Link to="/Privacy-Policy" className="text-sm font-medium hover:underline">
            Privacy Policy
          </Link>
          <Link to="/FAQ" className="text-sm font-medium hover:underline">
            FAQ
          </Link>
          <Link to="/Blog" className="text-sm font-medium hover:underline">
            Blog
          </Link>
          <Link to="/Help" className="text-sm font-medium hover:underline">
            Help & Artist
          </Link>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="w-full bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 text-center text-[12px] text-black">
          <div className="leading-snug">
            © All Rights Reserved to GoodPeople Medical Centre | Privacy Policy | Cookie Policy | Developed by{" "}
            <a
              href="https://www.upwork.com/freelancers/~01fb2e25952112c610"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Hasnain Babar
            </a>
          </div>
          <div className="font-bold leading-snug">Protected By Copyscape</div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
