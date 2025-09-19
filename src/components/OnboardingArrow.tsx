import React from 'react';

interface OnboardingArrowProps {
  direction?: 'up' | 'down' | 'left' | 'right';
  style?: React.CSSProperties; // absolute positioning by parent page
}

const rotations: Record<NonNullable<OnboardingArrowProps['direction']>, string> = {
  up: 'rotate-0',
  right: 'rotate-90',
  down: 'rotate-180',
  left: '-rotate-90',
};

const OnboardingArrow: React.FC<OnboardingArrowProps> = ({ direction = 'down', style }) => {
  return (
    <div style={style} className="pointer-events-none select-none absolute z-50">
      <svg className={`w-12 h-12 text-red-600 ${rotations[direction]}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2v20m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export default OnboardingArrow;
