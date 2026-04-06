import WizardStep from "./WizardStep";

interface SetupStepProjectProps {
  description: string;
  techStack: string;
  onDescriptionChange: (value: string) => void;
  onTechStackChange: (value: string) => void;
}

/**
 * Step 2: Project Info - Collect project description and tech stack
 */
export default function SetupStepProject({
  description,
  techStack,
  onDescriptionChange,
  onTechStackChange,
}: SetupStepProjectProps) {
  // Tech stack options matching the CLI
  const techStacks = [
    { name: "React/Next.js + TypeScript", value: "react" },
    { name: "Vue/Nuxt + TypeScript", value: "vue" },
    { name: "Node.js/Express API", value: "nodejs" },
    { name: "Python/FastAPI", value: "python" },
    { name: "Rust (Actix/Axum)", value: "rust" },
    { name: "Go/Gin API", value: "go" },
    { name: "Java/Spring Boot", value: "java" },
    { name: "C#/.NET", value: "dotnet" },
    { name: "Flutter (Mobile/Desktop)", value: "flutter" },
    { name: "Tauri (Rust + Web)", value: "tauri" },
    { name: "Electron (Desktop)", value: "electron" },
    { name: "Full-stack (React + Node)", value: "fullstack" },
    { name: "Mobile (React Native)", value: "mobile" },
    { name: "I'll decide later", value: "flexible" },
  ];

  return (
    <WizardStep
      stepNumber={2}
      totalSteps={5}
      title="Tell us about your project"
      description="What are you building? This helps us set up the right tools and documentation for you."
    >
      <div className="flex flex-col gap-6">
        {/* Project Description */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="description"
            className="text-sm font-medium"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Project Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe what you're building... (e.g., A task management app with AI-powered suggestions)"
            rows={4}
            className="px-4 py-3 rounded-lg border text-base outline-none transition-all duration-200 resize-none focus:ring-2"
            style={{
              background: "rgba(12, 16, 24, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent-color)";
              e.target.style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb), 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          />
        </div>

        {/* Tech Stack Selector */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="techStack"
            className="text-sm font-medium"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Primary Tech Stack
          </label>
          <select
            id="techStack"
            value={techStack}
            onChange={(e) => onTechStackChange(e.target.value)}
            className="px-4 py-3 rounded-lg border text-base outline-none transition-all duration-200 cursor-pointer focus:ring-2"
            style={{
              background: "rgba(12, 16, 24, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent-color)";
              e.target.style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb), 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          >
            {techStacks.map((stack) => (
              <option key={stack.value} value={stack.value}>
                {stack.name}
              </option>
            ))}
          </select>
        </div>

        {/* Info box */}
        <div
          className="mt-4 p-4 rounded-lg border"
          style={{
            background: "rgba(var(--accent-rgb), 0.05)",
            border: "1px solid rgba(var(--accent-rgb), 0.2)",
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            🦆 <strong style={{ color: "var(--accent-color)" }}>Quack Tip:</strong> Don't worry about being too specific. Jack and the team will help refine your project direction as you go!
          </p>
        </div>
      </div>
    </WizardStep>
  );
}
