import WizardStep from "./WizardStep";
import type { SetupWizardData } from "../types";

interface SetupStepReviewProps {
  data: SetupWizardData;
  projectPath: string;
}

/**
 * Step 5: Review - Review all settings before setup
 */
export default function SetupStepReview({
  data,
  projectPath,
}: SetupStepReviewProps) {
  // Get language name
  const getLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      english: "English",
      italian: "Italiano",
      spanish: "Español",
      french: "Français",
      german: "Deutsch",
      portuguese: "Português",
      dutch: "Nederlands",
      japanese: "日本語",
      korean: "한국어",
      chinese: "中文",
    };
    return languages[code] || code;
  };

  // Get tech stack name
  const getTechStackName = (value: string): string => {
    const stacks: Record<string, string> = {
      react: "React/Next.js + TypeScript",
      vue: "Vue/Nuxt + TypeScript",
      nodejs: "Node.js/Express API",
      python: "Python/FastAPI",
      rust: "Rust (Actix/Axum)",
      go: "Go/Gin API",
      java: "Java/Spring Boot",
      dotnet: "C#/.NET",
      flutter: "Flutter (Mobile/Desktop)",
      tauri: "Tauri (Rust + Web)",
      electron: "Electron (Desktop)",
      fullstack: "Full-stack (React + Node)",
      mobile: "Mobile (React Native)",
      flexible: "I'll decide later",
    };
    return stacks[value] || value;
  };

  // Get feature names
  const getFeatureNames = (features: string[]): string[] => {
    const featureMap: Record<string, string> = {
      ai: "AI Integration",
      database: "Database & Backend",
      auth: "Authentication",
      design: "UI/UX Design System",
      animations: "Animations & Interactions",
      i18n: "Internationalization",
      testing: "Testing Suite",
      analytics: "Analytics & Monitoring",
    };
    return features.map((f) => featureMap[f] || f);
  };

  return (
    <WizardStep
      stepNumber={5}
      totalSteps={5}
      title="Review & Confirm"
      description="Almost done! Review your settings before we set up Quack Agency for your project."
    >
      <div className="flex flex-col gap-4">
        {/* Summary Card */}
        <div
          className="p-4 rounded-lg border"
          style={{
            background: "rgba(12, 16, 24, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* Project Path */}
          <div className="mb-4 pb-4 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
            <div
              className="text-xs font-medium mb-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              PROJECT LOCATION
            </div>
            <div
              className="text-sm font-mono"
              style={{ color: "#f28c52" }}
            >
              {projectPath}
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div
                className="text-xs font-medium mb-1"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                YOUR NAME
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.9)" }}
              >
                {data.userName}
              </div>
            </div>
            <div>
              <div
                className="text-xs font-medium mb-1"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                LANGUAGE
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.9)" }}
              >
                {getLanguageName(data.userLanguage)}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <div
              className="text-xs font-medium mb-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              DESCRIPTION
            </div>
            <div
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.9)" }}
            >
              {data.description}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mb-4">
            <div
              className="text-xs font-medium mb-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              TECH STACK
            </div>
            <div
              className="inline-block px-3 py-1 rounded-full text-sm font-medium"
              style={{
                background: "rgba(242, 140, 82, 0.1)",
                color: "#f28c52",
                border: "1px solid rgba(242, 140, 82, 0.3)",
              }}
            >
              {getTechStackName(data.techStack)}
            </div>
          </div>

          {/* Features */}
          {data.features.length > 0 && (
            <div className="mb-4">
              <div
                className="text-xs font-medium mb-2"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                FEATURES ({data.features.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {getFeatureNames(data.features).map((feature, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      background: "rgba(242, 140, 82, 0.1)",
                      color: "rgba(255, 255, 255, 0.8)",
                      border: "1px solid rgba(242, 140, 82, 0.2)",
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="pt-4 border-t" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
            <div
              className="text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              OPTIONS
            </div>
            <div className="flex flex-col gap-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
              <div className="flex items-center gap-2">
                <span style={{ color: data.initGit ? "#10B981" : "#6B7280" }}>
                  {data.initGit ? "✓" : "○"}
                </span>
                Initialize Git Repository
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: data.createAgents ? "#10B981" : "#6B7280" }}>
                  {data.createAgents ? "✓" : "○"}
                </span>
                Create Specialist Agents (7 agents)
              </div>
            </div>
          </div>
        </div>

        {/* Ready message */}
        <div
          className="p-4 rounded-lg border text-center"
          style={{
            background: "rgba(242, 140, 82, 0.05)",
            border: "1px solid rgba(242, 140, 82, 0.2)",
          }}
        >
          <div className="text-2xl mb-2">🦆</div>
          <p
            className="text-base font-semibold mb-1"
            style={{ color: "#f28c52" }}
          >
            Ready to set up Quack Agency!
          </p>
          <p
            className="text-sm"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Click "Complete Setup" to initialize your project with all the team and tools you selected. Quack quack!
          </p>
        </div>
      </div>
    </WizardStep>
  );
}
