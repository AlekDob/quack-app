import WizardStep from "./WizardStep";

interface SetupStepOptionsProps {
  initGit: boolean;
  createAgents: boolean;
  onInitGitChange: (value: boolean) => void;
  onCreateAgentsChange: (value: boolean) => void;
}

/**
 * Step 4: Options - Configure setup options
 */
export default function SetupStepOptions({
  initGit,
  createAgents,
  onInitGitChange,
  onCreateAgentsChange,
}: SetupStepOptionsProps) {
  return (
    <WizardStep
      stepNumber={4}
      totalSteps={5}
      title="Setup Options"
      description="Choose how you want to initialize your Quack Agency project."
    >
      <div className="flex flex-col gap-6">
        {/* Initialize Git Toggle */}
        <div
          className="p-4 rounded-lg border"
          style={{
            background: "rgba(12, 16, 24, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📦</span>
                <h3
                  className="text-base font-semibold"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  Initialize Git Repository
                </h3>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                Create a git repository and make an initial commit with the Quack Agency setup.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => onInitGitChange(!initGit)}
              className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                background: initGit
                  ? "linear-gradient(135deg, #f28c52 0%, #e67339 100%)"
                  : "rgba(255, 255, 255, 0.2)",
                boxShadow: initGit
                  ? "0 2px 8px rgba(242, 140, 82, 0.4)"
                  : "0 2px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                  initGit ? "translate-x-6" : "translate-x-1"
                }`}
                style={{
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Create Agents Toggle */}
        <div
          className="p-4 rounded-lg border"
          style={{
            background: "rgba(12, 16, 24, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤖</span>
                <h3
                  className="text-base font-semibold"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  Create Specialist Agents
                </h3>
              </div>
              <p
                className="text-sm leading-relaxed mb-2"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                Set up all 7 specialist agents: Mike, Scott, Julie, John, Carmelo, Giuseppe, and Roberta.
              </p>

              {/* Agent list preview */}
              {createAgents && (
                <div
                  className="mt-3 p-3 rounded-lg text-xs"
                  style={{
                    background: "rgba(242, 140, 82, 0.05)",
                    border: "1px solid rgba(242, 140, 82, 0.2)",
                  }}
                >
                  <ul
                    className="grid grid-cols-2 gap-2"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    <li>✓ Mike (Project Manager)</li>
                    <li>✓ Scott (HR Manager)</li>
                    <li>✓ Julie (UI/UX Designer)</li>
                    <li>✓ John (Backend Architect)</li>
                    <li>✓ Carmelo (Prompt Engineer)</li>
                    <li>✓ Giuseppe (Git Manager)</li>
                    <li>✓ Roberta (Setup Expert)</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => onCreateAgentsChange(!createAgents)}
              className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                background: createAgents
                  ? "linear-gradient(135deg, #f28c52 0%, #e67339 100%)"
                  : "rgba(255, 255, 255, 0.2)",
                boxShadow: createAgents
                  ? "0 2px 8px rgba(242, 140, 82, 0.4)"
                  : "0 2px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
                  createAgents ? "translate-x-6" : "translate-x-1"
                }`}
                style={{
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Info box */}
        <div
          className="mt-2 p-4 rounded-lg border"
          style={{
            background: "rgba(242, 140, 82, 0.05)",
            border: "1px solid rgba(242, 140, 82, 0.2)",
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            💡 <strong style={{ color: "#f28c52" }}>Recommended:</strong> Enable both options for the full Quack Agency experience. Quack quack!
          </p>
        </div>
      </div>
    </WizardStep>
  );
}
