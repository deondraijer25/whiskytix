import React from 'react';
import leadfabriekLogo from '../../assets/logos/Leadfabriek/SVG/Leadfabriek logo.svg';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`w-full py-6 mt-auto font-sans select-none ${className}`}>
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs sm:text-[13px] text-[#4c5752]">
        <span>Voor vragen en contact neem contact op met</span>
        <a
          href="https://leadfabriek.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-bold text-[#1D1C1A] hover:text-[#006448] transition-all group"
          title="Leadfabriek - leadfabriek.io"
        >
          <img
            src={leadfabriekLogo}
            alt="Leadfabriek"
            className="h-5 sm:h-5.5 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span className="text-[#006448] underline underline-offset-4 decoration-[#8ba198] group-hover:decoration-[#006448] transition-colors">
            leadfabriek.io
          </span>
          <span className="text-[11px] text-[#8ba198] group-hover:text-[#006448] transition-colors">
            ↗
          </span>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
