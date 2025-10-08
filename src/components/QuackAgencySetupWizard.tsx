import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SetupWizardData, SetupResult } from "../types";
import SetupStepWelcome from "./SetupStepWelcome";
import SetupStepProject from "./SetupStepProject";
import SetupStepFeatures from "./SetupStepFeatures";
import SetupStepOptions from "./SetupStepOptions";
import SetupStepReview from "./SetupStepReview";

interface QuackAgencySetupWizardProps {
  open: boolean;
  workingDir?: string;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Main Quack Agency Setup Wizard Component
 * Multi-step wizard for configuring and initializing Quack Agency
 */
export default function QuackAgencySetupWizard({
  open,
  workingDir = "",
  onClose,
  onComplete,
}: QuackAgencySetupWizardProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);

  // Form data state
  const [formData, setFormData] = useState<SetupWizardData>({
    userName: "",
    userLanguage: "english",
    description: "An awesome project with AI-powered features",
    techStack: "tauri",
    features: [],
    initGit: true,
    createAgents: true,
  });

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Form update handlers
  const updateField = <K extends keyof SetupWizardData>(
    field: K,
    value: SetupWizardData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Validation
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return formData.userName.trim().length > 0;
      case 2:
        return formData.description.trim().length > 0;
      default:
        return true;
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const result = await invoke<SetupResult>("setup_quack_agency_full", {
        data: formData,
        workingDir: workingDir || undefined,
      });

      setSetupResult(result);
      setSetupComplete(true);

      // Auto-complete after showing success
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Setup failed:", error);
      alert(`Setup failed: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close handler
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset state after animation
      setTimeout(() => {
        setCurrentStep(1);
        setSetupComplete(false);
        setSetupResult(null);
      }, 300);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
        }}
        onClick={handleClose}
      />

      {/* Wizard Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl pointer-events-auto overflow-hidden transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, #0c1018 0%, #1a1f2e 100%)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <h2
              className="text-xl font-bold"
              style={{ color: "#f28c52" }}
            >
              🦆 Quack Agency Setup
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
              style={{
                color: "rgba(255, 255, 255, 0.6)",
                background: "rgba(255, 255, 255, 0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {!setupComplete ? (
              <>
                {/* Step 1: Welcome */}
                {currentStep === 1 && (
                  <SetupStepWelcome
                    userName={formData.userName}
                    userLanguage={formData.userLanguage}
                    onUserNameChange={(value) => updateField("userName", value)}
                    onUserLanguageChange={(value) => updateField("userLanguage", value)}
                  />
                )}

                {/* Step 2: Project */}
                {currentStep === 2 && (
                  <SetupStepProject
                    description={formData.description}
                    techStack={formData.techStack}
                    onDescriptionChange={(value) => updateField("description", value)}
                    onTechStackChange={(value) => updateField("techStack", value)}
                  />
                )}

                {/* Step 3: Features */}
                {currentStep === 3 && (
                  <SetupStepFeatures
                    features={formData.features}
                    onFeaturesChange={(value) => updateField("features", value)}
                  />
                )}

                {/* Step 4: Options */}
                {currentStep === 4 && (
                  <SetupStepOptions
                    initGit={formData.initGit}
                    createAgents={formData.createAgents}
                    onInitGitChange={(value) => updateField("initGit", value)}
                    onCreateAgentsChange={(value) => updateField("createAgents", value)}
                  />
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <SetupStepReview
                    data={formData}
                    projectPath={workingDir || "Current directory"}
                  />
                )}
              </>
            ) : (
              /* Success Screen */
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-bounce"
                  style={{
                    background: "linear-gradient(135deg, #f28c52 0%, #e67339 100%)",
                    boxShadow: "0 8px 24px rgba(242, 140, 82, 0.4)",
                  }}
                >
                  <span className="text-4xl">🦆</span>
                </div>

                <h3
                  className="text-2xl font-bold mb-2"
                  style={{ color: "#f28c52" }}
                >
                  Setup Complete!
                </h3>

                <p
                  className="text-base mb-6"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  {setupResult?.message || "Quack Agency has been successfully set up!"}
                </p>

                {setupResult && (
                  <div
                    className="w-full max-w-md p-4 rounded-lg text-sm"
                    style={{
                      background: "rgba(242, 140, 82, 0.05)",
                      border: "1px solid rgba(242, 140, 82, 0.2)",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    <div className="flex justify-between mb-2">
                      <span>Files created:</span>
                      <span className="font-semibold" style={{ color: "#f28c52" }}>
                        {setupResult.filesCreated.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Agents created:</span>
                      <span className="font-semibold" style={{ color: "#f28c52" }}>
                        {setupResult.agentsCreated}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!setupComplete && (
            <div
              className="flex items-center justify-between px-6 py-4 border-t"
              style={{
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              {/* Previous Button */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 1 || isSubmitting}
                className="px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
                onMouseEnter={(e) => {
                  if (currentStep > 1 && !isSubmitting) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                }}
              >
                Previous
              </button>

              {/* Next/Submit Button */}
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: canProceed()
                      ? "linear-gradient(135deg, #f28c52 0%, #e67339 100%)"
                      : "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    boxShadow: canProceed()
                      ? "0 4px 12px rgba(242, 140, 82, 0.3)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (canProceed() && !isSubmitting) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(242, 140, 82, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = canProceed()
                      ? "0 4px 12px rgba(242, 140, 82, 0.3)"
                      : "none";
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #f28c52 0%, #e67339 100%)",
                    color: "#ffffff",
                    boxShadow: "0 4px 12px rgba(242, 140, 82, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(242, 140, 82, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(242, 140, 82, 0.3)";
                  }}
                >
                  {isSubmitting ? "Setting up..." : "Complete Setup"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
