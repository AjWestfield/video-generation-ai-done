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
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* Step circle */}
            <div
              className="relative flex flex-col items-center cursor-pointer"
              onClick={() => onStepClick && onStepClick(index)}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  index <= currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400"
                } ${
                  index < currentStep
                    ? "hover:bg-blue-500"
                    : index > currentStep
                    ? "opacity-50"
                    : ""
                }`}
              >
                {index < currentStep ? (
                  <svg
                    className="w-4 h-4"
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
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={`absolute top-10 w-max text-center text-xs ${
                  index <= currentStep ? "text-gray-300" : "text-gray-500"
                }`}
              >
                {step}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 ${
                  index < currentStep ? "bg-blue-600" : "bg-gray-700"
                }`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ProgressStepper; 