import WizardStep from "./WizardStep";

interface SetupStepFeaturesProps {
  features: string[];
  onFeaturesChange: (features: string[]) => void;
}

/**
 * Step 3: Features - Select project features and capabilities
 */
export default function SetupStepFeatures({
  features,
  onFeaturesChange,
}: SetupStepFeaturesProps) {
  // Feature options matching the CLI
  const availableFeatures = [
    { name: "AI Integration (LLM APIs)", value: "ai", icon: "🤖" },
    { name: "Database & Backend", value: "database", icon: "🗄️" },
    { name: "Authentication", value: "auth", icon: "🔐" },
    { name: "UI/UX Design System", value: "design", icon: "🎨" },
    { name: "Animations & Interactions", value: "animations", icon: "✨" },
    { name: "Internationalization (i18n)", value: "i18n", icon: "🌍" },
    { name: "Testing Suite", value: "testing", icon: "🧪" },
    { name: "Analytics & Monitoring", value: "analytics", icon: "📊" },
  ];

  const handleFeatureToggle = (featureValue: string) => {
    if (features.includes(featureValue)) {
      // Remove feature
      onFeaturesChange(features.filter((f) => f !== featureValue));
    } else {
      // Add feature
      onFeaturesChange([...features, featureValue]);
    }
  };

  return (
    <WizardStep
      stepNumber={3}
      totalSteps={5}
      title="Choose your features"
      description="Select the capabilities and tools you need for your project. You can always add more later!"
    >
      <div className="flex flex-col gap-4">
        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-3">
          {availableFeatures.map((feature) => {
            const isSelected = features.includes(feature.value);

            return (
              <button
                key={feature.value}
                type="button"
                onClick={() => handleFeatureToggle(feature.value)}
                className="flex items-center gap-4 px-6 py-6 rounded-lg border transition-all duration-200 text-left"
                style={{
                  background: isSelected
                    ? "rgba(242, 140, 82, 0.1)"
                    : "rgba(12, 16, 24, 0.6)",
                  border: isSelected
                    ? "1px solid #f28c52"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                  boxShadow: isSelected
                    ? "0 4px 12px rgba(242, 140, 82, 0.2)"
                    : "0 2px 8px rgba(0, 0, 0, 0.2)",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
              >
                {/* Checkbox */}
                <div
                  className="flex items-center justify-center w-6 h-6 rounded border-2 transition-all duration-200 flex-shrink-0"
                  style={{
                    borderColor: isSelected ? "#f28c52" : "rgba(255, 255, 255, 0.3)",
                    background: isSelected ? "#f28c52" : "transparent",
                  }}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 20 20"
                      className="w-4 h-4"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                    >
                      <path d="M5 10l3 3 7-7" />
                    </svg>
                  )}
                </div>

                {/* Icon and Label */}
                <span className="text-xl flex-shrink-0" style={{ lineHeight: "1.5" }}>{feature.icon}</span>
                <span
                  className="flex-1 text-base font-medium"
                  style={{
                    color: isSelected ? "#f28c52" : "rgba(255, 255, 255, 0.9)",
                  }}
                >
                  {feature.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected count */}
        {features.length > 0 && (
          <div
            className="mt-4 p-3 rounded-lg text-center text-sm font-medium"
            style={{
              background: "rgba(242, 140, 82, 0.1)",
              color: "#f28c52",
            }}
          >
            ✓ {features.length} feature{features.length !== 1 ? "s" : ""} selected
          </div>
        )}

        {/* Info box */}
        {features.length === 0 && (
          <div
            className="mt-4 p-4 rounded-lg border"
            style={{
              background: "rgba(242, 140, 82, 0.05)",
              border: "1px solid rgba(242, 140, 82, 0.2)",
            }}
          >
            <p
              className="text-sm leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              💡 <strong style={{ color: "#f28c52" }}>Tip:</strong> Select at least one feature to help the team understand your project needs. You can skip this if you're not sure yet!
            </p>
          </div>
        )}
      </div>
    </WizardStep>
  );
}
