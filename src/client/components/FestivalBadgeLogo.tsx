import React from 'react';
import logoWhiskyTix from '../../assets/logos/Whisky tix logo basis.svg';
import logoGent from '../../assets/logos/logo-gent.svg';
import logoDenHaag from '../../assets/logos/logo-denhaag-color.svg';
import logoAmsterdam from '../../assets/logos/logo-amsterdam-color.svg';

interface FestivalBadgeLogoProps {
  cityId?: string;
  className?: string;
  showCityBadge?: boolean;
}

export const FestivalBadgeLogo: React.FC<FestivalBadgeLogoProps> = ({
  cityId = 'whiskytix',
  className = '',
  showCityBadge = false,
}) => {
  const normalized = (cityId || '').toLowerCase().trim();

  // Default to official Whisky Tix seal logo (identical to login page)
  let logoSrc = logoWhiskyTix;
  let altText = 'Whisky Tix';

  if (showCityBadge) {
    if (normalized.includes('gent')) {
      logoSrc = logoGent;
      altText = 'Gents Whisky Festival';
    } else if (normalized.includes('amsterdam')) {
      logoSrc = logoAmsterdam;
      altText = 'Whisky Festival Amsterdam';
    } else if (normalized.includes('denhaag') || normalized.includes('haag')) {
      logoSrc = logoDenHaag;
      altText = 'International Whisky Festival Den Haag';
    }
  }

  return (
    <div
      className={`relative z-30 shrink-0 transition-transform duration-200 hover:scale-105 filter drop-shadow-[0_4px_10px_rgba(29,28,26,0.22)] cursor-pointer top-4 sm:top-5 md:top-6 ${className}`}
    >
      <img
        src={logoSrc}
        alt={altText}
        className="w-20 sm:w-24 md:w-28 h-auto object-contain block select-none pointer-events-auto"
      />
    </div>
  );
};

