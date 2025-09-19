import React from 'react';

interface OnboardingModalProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onNext?: () => void;
  onBack?: () => void;
  onClose?: () => void;
  canNext?: boolean;
  nextButtonText?: string;
}

const positionClasses: Record<NonNullable<OnboardingModalProps['position']>, string> = {
  center: 'inset-0 flex items-center justify-center',
  'top-left': 'inset-0 items-start justify-start p-6',
  'top-right': 'inset-0 items-start justify-end p-6',
  'bottom-left': 'inset-0 items-end justify-start p-6',
  'bottom-right': 'inset-0 items-end justify-end p-6',
};

const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  title,
  body,
  position = 'center',
  onNext,
  onBack,
  onClose,
  canNext = true,
  nextButtonText = 'Next',
}) => {
  if (!isOpen) return null;
  return (
    <div className={`fixed z-50 ${positionClasses[position]} bg-black/40`}> 
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 border-2 ">
        <div className='border-gray-200 p-3'>

        <div className="text-sm text-black mb-2">Tutorial</div>
        <h3 className="text-2xl font-bold mb-3">{title}</h3>
        <hr className="mb-4 border-gray-200" />
        <div className="text-gray-800 mb-8 leading-relaxed">{body}</div>
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 disabled:opacity-50"
            disabled={!onBack}
          >
            Back
          </button>
          <div className="space-x-2">
            {onClose && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the top-right.')) { onClose(); } }}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
              >
                Skip onboarding
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className="px-4 py-2 rounded-lg bg-orange text-white disabled:opacity-50"
              >
                {nextButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
