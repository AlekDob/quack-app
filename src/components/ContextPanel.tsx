/**
 * Context Panel - Placeholder for future context management features
 */

export default function ContextPanel() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 text-center"
      style={{
        background: "#0c1018",
      }}
    >
      <div className="text-6xl mb-6">📝</div>
      <h3
        className="text-xl font-bold mb-3"
        style={{ color: "#f28c52" }}
      >
        Context Panel
      </h3>
      <p
        className="text-base mb-2 max-w-md"
        style={{ color: "rgba(255, 255, 255, 0.7)" }}
      >
        This feature is coming soon!
      </p>
      <p
        className="text-sm max-w-md"
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        The context panel will help you manage and organize your project context for AI assistants.
      </p>

      {/* Placeholder features list */}
      <div
        className="mt-8 p-4 rounded-lg max-w-md w-full text-left"
        style={{
          background: "rgba(242, 140, 82, 0.05)",
          border: "1px solid rgba(242, 140, 82, 0.2)",
        }}
      >
        <div
          className="text-sm font-semibold mb-3"
          style={{ color: "#f28c52" }}
        >
          Planned Features:
        </div>
        <ul
          className="space-y-2 text-sm"
          style={{ color: "rgba(255, 255, 255, 0.7)" }}
        >
          <li className="flex items-start gap-2">
            <span style={{ color: "#f28c52" }}>•</span>
            <span>Add files and folders to context</span>
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "#f28c52" }}>•</span>
            <span>Manage conversation history</span>
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "#f28c52" }}>•</span>
            <span>Save and reuse context templates</span>
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "#f28c52" }}>•</span>
            <span>Token usage tracking</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
