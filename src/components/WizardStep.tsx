import type { ReactNode } from "react";

interface WizardStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Composable wizard step component
 * Provides consistent layout and progress indicator for each step
 */
export default function WizardStep({
  stepNumber,
  totalSteps,
  title,
  description,
  children,
}: WizardStepProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isActive = index + 1 === stepNumber;
          const isCompleted = index + 1 < stepNumber;

          return (
            <div
              key={index}
              className="flex-1 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: isActive || isCompleted
                  ? "linear-gradient(135deg, #f28c52 0%, #e67339 100%)"
                  : "rgba(255, 255, 255, 0.1)",
              }}
            />
          );
        })}
      </div>

      {/* Step number badge */}
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-4 text-sm font-semibold"
        style={{
          background: "linear-gradient(135deg, #f28c52 0%, #e67339 100%)",
          color: "#ffffff",
        }}
      >
        {stepNumber}
      </div>

      {/* Title and description */}
      <h2
        className="text-2xl font-bold mb-2"
        style={{ color: "#f28c52" }}
      >
        {title}
      </h2>

      {description && (
        <p
          className="mb-6 text-sm leading-relaxed"
          style={{ color: "rgba(255, 255, 255, 0.7)" }}
        >
          {description}
        </p>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
