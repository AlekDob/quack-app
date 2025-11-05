# Metro-Style Visual System for Git Worktree Management

## Overview
We've implemented a beautiful subway/metro map aesthetic for visualizing the relationship between main repositories and their Git worktrees in the Quack app sidebar.

## Components Created

### 1. MetroLine Component (`src/components/MetroLine.tsx`)
A visual connector component that creates subway-map style connection lines between related items.

**Features:**
- Four line types: `main`, `worktree`, `connection`, `fork`
- Gradient effects and shadows for depth
- Animated pulse effects for active states
- Fork junction visualization with curves and branches

### 2. RepositoryGroup Component (`src/components/RepositoryGroup.tsx`)
Groups agents by repository, separating main repository agents from worktree agents.

**Features:**
- Repository header with agent count
- Separate sections for main repo and worktrees
- Metro-style left borders (green for main, forest green for worktrees)
- Visual connection lines showing relationships
- Hover effects and active state highlighting

### 3. GitOperationsDropdown Component (`src/components/GitOperationsDropdown.tsx`)
A dropdown menu on branch badges for Git operations.

**Features:**
- Context-aware menu items (different for main repo vs worktree)
- Operations include: merge, pull, push, create PR, view diff, delete worktree
- Clean dropdown animation
- Icon-based menu items for clarity

### 4. MetroStyle CSS (`src/components/MetroStyle.css`)
Complete styling system for the metro-style UI.

**Features:**
- Smooth animations (pulse, flow, slideDown)
- Enhanced visual hierarchy
- Gradient transitions at branch points
- Active agent pulse effects
- Responsive hover states

## Visual Design

### Color Scheme
- **Main Repository**: Verde smeraldo (#10b981) - Bright emerald green
- **Worktrees**: Verde foresta (#059669) - Deep forest green
- **Connection Lines**: Gradients between colors for smooth transitions

### Layout Structure
```
┌─ Repository Name (e.g., quack-app)
│
├─ MAIN REPOSITORY
│  ├─ Agent Jordan [main] 🟢
│  └─ Agent Charlie [main] 🟢
│     ╔═══ FORK POINT (visual branch)
│     ║
└─ WORKTREES
   ├─ Agent Mike [feature/giuseppe] 🌳
   └─ Agent Sarah [feature/ui-update] 🌳
```

## User Interface Enhancements

### 1. Toggle Switch
- Users can switch between metro-style and legacy views
- Checkbox at the top of the sidebar
- Preference is not persisted (defaults to metro-style)

### 2. Compact Agent Cards
- Cleaner typography with better spacing
- Avatar or colored dot indicator
- Branch badge with dropdown menu
- Status indicators (busy/idle)
- Hover effects with gradient backgrounds

### 3. Visual Hierarchy
- Clear separation between main and worktree agents
- Indentation shows relationship
- Section labels (MAIN REPOSITORY / WORKTREES)
- Repository groups are collapsible

## Implementation Details

### Repository Detection Logic
The system intelligently detects worktrees by:
1. Checking for `-worktree-` in the path
2. Using the `useWorktree` flag on terminals
3. Extracting base repository names from paths

### Grouping Algorithm
1. Parse all terminals
2. Identify main repos vs worktrees
3. Group by base repository name
4. Create visual hierarchy with proper indentation

### Git Operations Handler
Currently logs operations to console. Ready for backend integration:
```typescript
const handleGitOperation = (operation: string, terminal: TerminalInfo) => {
  // TODO: Implement actual Git operations via Tauri commands
}
```

## Usage

### For Users
1. The metro-style view is enabled by default
2. Toggle between views using the checkbox in the sidebar
3. Click on branch badges to access Git operations
4. Collapse/expand repository groups by clicking headers

### For Developers
```typescript
// Import the components
import RepositoryGroup from './components/RepositoryGroup';
import MetroLine from './components/MetroLine';
import GitOperationsDropdown from './components/GitOperationsDropdown';

// Use in your component
<RepositoryGroup
  repoPath={path}
  repoName={name}
  mainAgents={mainAgents}
  worktreeAgents={worktreeAgents}
  // ... other props
/>
```

## Future Enhancements

### Planned Features
1. **Persistent View Preference**: Save user's choice of metro vs legacy view
2. **Animated Transitions**: Smooth animations when switching views
3. **Git Operations Integration**: Connect dropdown actions to backend Git commands
4. **Branch Flow Visualization**: Show merge flow and branch relationships
5. **Custom Colors**: Allow users to customize metro line colors per project

### Potential Improvements
1. **Drag & Drop**: Reorder agents within groups
2. **Branch Creation**: Create new worktrees directly from UI
3. **Status Indicators**: Show uncommitted changes, ahead/behind counts
4. **Multi-Repository Support**: Handle multiple unrelated repositories
5. **Search/Filter**: Quick filter for agents by name or branch

## Technical Notes

### Performance Considerations
- CSS animations use GPU-accelerated properties (transform, opacity)
- React memoization prevents unnecessary re-renders
- Conditional rendering for collapsed groups improves performance

### Accessibility
- Proper contrast ratios maintained
- Keyboard navigation supported
- ARIA labels where appropriate
- Focus indicators for interactive elements

### Browser Compatibility
- Modern CSS features used (Grid, Flexbox, CSS Variables)
- Tested in Chromium-based browsers (Tauri uses WebKit/Chromium)
- Graceful degradation for older browsers

## Conclusion
The metro-style visual system transforms the agent sidebar into a beautiful, functional interface that clearly shows the relationship between main repositories and their worktrees. The subway map metaphor is both intuitive and visually appealing, making complex Git workflows easier to understand at a glance.