import React from "react";

interface ProgressStepperProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* Step circle */}
            <div
              className="relative flex flex-col items-center cursor-pointer group"
              onClick={() => onStepClick && onStepClick(index)}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full transition-all duration-300 ${
                  index < currentStep
                    ? "bg-[rgba(var(--accent-cyan),0.9)] text-white box-glow-cyan"
                    : index === currentStep
                    ? "bg-[rgba(var(--accent-blue),0.9)] text-white box-glow"
                    : "bg-[rgba(10,15,30,0.7)] text-gray-400 border border-[rgba(var(--accent-blue),0.3)]"
                } ${
                  index < currentStep
                    ? "hover:bg-[rgba(var(--accent-cyan),1)] hover:scale-110"
                    : index === currentStep 
                    ? "scale-105 hover:bg-[rgba(var(--accent-blue),1)]" 
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                {index < currentStep ? (
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span className="text-xs md:text-sm">{index + 1}</span>
                )}
              </div>
              
              {/* Step label */}
              <span
                className={`absolute top-8 md:top-10 text-xs md:text-sm w-max text-center transition-all duration-300 group-hover:scale-105 ${
                  index < currentStep 
                    ? "text-[rgba(var(--accent-cyan),1)] text-glow-cyan" 
                    : index === currentStep
                    ? "text-[rgba(var(--accent-blue),1)] font-medium text-glow" 
                    : "text-gray-400"
                }`}
              >
                {step}
              </span>
              
              {/* Pulse effect for current step */}
              {index === currentStep && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-[rgba(var(--accent-blue),0.5)]" style={{ animationDuration: '3s' }}></div>
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 flex items-center mx-1 md:mx-2">
                <div
                  className={`h-0.5 w-full transition-all duration-500 ${
                    index < currentStep 
                      ? "bg-gradient-to-r from-[rgba(var(--accent-cyan),0.9)] to-[rgba(var(--accent-blue),0.9)]" 
                      : "bg-[rgba(var(--accent-blue),0.2)]"
                  }`}
                ></div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ProgressStepper; 