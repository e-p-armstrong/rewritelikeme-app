import React from 'react';

interface OnboardingNudgeProps {
  title: string;
  body: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onNext?: () => void;
  onClose?: () => void;
}

const pos: Record<NonNullable<OnboardingNudgeProps['position']>, string> = {
  'top-right': 'top-16 right-4',
  'top-left': 'top-16 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

const OnboardingNudge: React.FC<OnboardingNudgeProps> = ({ title, body, position = 'top-right', onNext, onClose }) => {
  return (
    <div className={`fixed z-40 ${pos[position]} pointer-events-none`}> 
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-80 pointer-events-auto">
        <div className="text-xs uppercase text-gray-500 mb-1">Tutorial</div>
        <div className="text-lg font-semibold mb-2">{title}</div>
        <div className="text-sm text-gray-800 mb-4">{body}</div>
        {(onNext || onClose) && (
          <div className="flex justify-end space-x-2">
            {onClose && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the top-right.')) { onClose(); } }}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Skip
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                className="px-3 py-1.5 text-xs rounded-lg bg-orange text-white hover:bg-opacity-80 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingNudge;


