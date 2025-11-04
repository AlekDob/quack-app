// ===================================================================
// SNIPPET 1: Add these state variables around line 505-510
// (after const [editingCommand, setEditingCommand] = useState...)
// ===================================================================

const [sessionDetailsDrawerOpen, setSessionDetailsDrawerOpen] = useState(false);
const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);

// ===================================================================
// SNIPPET 2: Add these handlers around line 3000 (with other handlers)
// ===================================================================

const handleSelectSession = useCallback((session: SessionInfo) => {
  setSelectedSession(session);
  setSessionDetailsDrawerOpen(true);
}, []);

const handleResumeSession = useCallback(async (sessionId: string) => {
  try {
    // Resume the session in the current agent chat
    if (activeId) {
      // The session will be automatically resumed by passing sessionId to claudeSDK
      toast.success('Session will be resumed in next message');
      setSessionDetailsDrawerOpen(false);

      // TODO: Could add logic to load session history into chat view here
    } else {
      toast.error('Please select an agent first');
    }
  } catch (error) {
    console.error('Failed to resume session:', error);
    toast.error('Failed to resume session');
  }
}, [activeId]);

const handleDeleteSession = useCallback(async (sessionId: string) => {
  try {
    await invoke('delete_session', { sessionId });
    toast.success('Session deleted successfully');
    return Promise.resolve();
  } catch (error) {
    console.error('Failed to delete session:', error);
    toast.error('Failed to delete session');
    return Promise.reject(error);
  }
}, []);

// ===================================================================
// SNIPPET 3: Add this prop to SidePanel component (around line 5461)
// Find the <SidePanel ... /> component and add:
// ===================================================================

onSelectSession={handleSelectSession}

// ===================================================================
// SNIPPET 4: Add SessionDetailsDrawer before the closing tags (around line 5650)
// Add it after SavedCommandsDrawer or other drawer components:
// ===================================================================

<SessionDetailsDrawer
  session={selectedSession}
  open={sessionDetailsDrawerOpen}
  onClose={() => setSessionDetailsDrawerOpen(false)}
  onResume={handleResumeSession}
  onDelete={handleDeleteSession}
/>
