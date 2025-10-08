import WizardStep from "./WizardStep";

interface SetupStepWelcomeProps {
  userName: string;
  userLanguage: string;
  onUserNameChange: (value: string) => void;
  onUserLanguageChange: (value: string) => void;
}

/**
 * Step 1: Welcome - Collect user name and preferred language
 */
export default function SetupStepWelcome({
  userName,
  userLanguage,
  onUserNameChange,
  onUserLanguageChange,
}: SetupStepWelcomeProps) {
  // Language options matching the CLI
  const languages = [
    { name: "🇬🇧 English", value: "english" },
    { name: "🇮🇹 Italiano", value: "italian" },
    { name: "🇪🇸 Español", value: "spanish" },
    { name: "🇫🇷 Français", value: "french" },
    { name: "🇩🇪 Deutsch", value: "german" },
    { name: "🇵🇹 Português", value: "portuguese" },
    { name: "🇳🇱 Nederlands", value: "dutch" },
    { name: "🇯🇵 日本語", value: "japanese" },
    { name: "🇰🇷 한국어", value: "korean" },
    { name: "🇨🇳 中文", value: "chinese" },
  ];

  return (
    <WizardStep
      stepNumber={1}
      totalSteps={5}
      title="Welcome to Quack Agency! 🦆"
      description="Let's get to know you. Quack quack! This information will help personalize your project setup."
    >
      <div className="flex flex-col gap-6">
        {/* User Name Input */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="userName"
            className="text-sm font-medium"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Your Name
          </label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            placeholder="e.g., John Doe"
            className="px-4 py-3 rounded-lg border text-base outline-none transition-all duration-200 focus:ring-2"
            style={{
              background: "rgba(12, 16, 24, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#f28c52";
              e.target.style.boxShadow = "0 0 0 3px rgba(242, 140, 82, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          />
        </div>

        {/* Language Selector */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="userLanguage"
            className="text-sm font-medium"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Preferred Language
          </label>
          <select
            id="userLanguage"
            value={userLanguage}
            onChange={(e) => onUserLanguageChange(e.target.value)}
            className="px-4 py-3 rounded-lg border text-base outline-none transition-all duration-200 cursor-pointer focus:ring-2"
            style={{
              background: "rgba(12, 16, 24, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#f28c52";
              e.target.style.boxShadow = "0 0 0 3px rgba(242, 140, 82, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Info box */}
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
            💡 <strong style={{ color: "#f28c52" }}>Tip:</strong> Your language preference will be used for Jack's communication style throughout the project.
          </p>
        </div>
      </div>
    </WizardStep>
  );
}
