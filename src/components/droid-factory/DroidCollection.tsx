import type { UserStats } from './types';

interface DroidCollectionProps {
  userStats: UserStats;
}

export function DroidCollection({ userStats }: DroidCollectionProps) {
  return (
    <div>
      <p className="text-xs mb-3 leading-tight" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        Your personal collection of droids and achievements.
      </p>

      {/* Achievements Section - More spacious */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z" fill="rgba(255, 255, 255, 0.5)" />
          </svg>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
            Achievements Unlocked ({userStats.achievements.length})
          </h4>
        </div>

        {userStats.achievements.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {userStats.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="rounded-lg p-3 transition-all duration-200"
                style={{
                  background: '#090A0C',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z" fill="var(--accent-color)" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5
                      className="text-sm font-semibold leading-tight"
                      style={{ color: '#ffffff' }}
                    >
                      {achievement.name}
                    </h5>
                    <p
                      className="text-xs mt-1 leading-tight"
                      style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      {achievement.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="9" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" />
                        <path d="M12 6V12L16 14" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <p
                        className="text-xs"
                        style={{ color: 'rgba(255, 255, 255, 0.4)' }}
                      >
                        {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg p-6 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3" opacity="0.3">
              <path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" fill="none" />
            </svg>
            <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Create your first droid to unlock achievements
            </p>
          </div>
        )}
      </div>

      {/* Stats Section - More spacious */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" fill="rgba(255, 255, 255, 0.5)" opacity="0.6" />
            <rect x="3" y="14" width="7" height="7" rx="1" fill="rgba(255, 255, 255, 0.5)" />
            <rect x="14" y="3" width="7" height="7" rx="1" fill="rgba(255, 255, 255, 0.5)" />
            <rect x="14" y="14" width="7" height="7" rx="1" fill="rgba(255, 255, 255, 0.5)" opacity="0.6" />
          </svg>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
            Statistics
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-lg p-4 text-center transition-all duration-200"
            style={{
              background: '#090A0C',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex justify-center mb-2">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="8" height="8" rx="1" stroke="#6b7280" strokeWidth="1.2" fill="none" />
                <circle cx="7" cy="7" r="0.8" fill="#6b7280" />
                <circle cx="9" cy="7" r="0.8" fill="#6b7280" />
                <path d="M6.5 9.5C6.5 9.5 7 10 8 10C9 10 9.5 9.5 9.5 9.5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-2xl font-bold mb-1 leading-none" style={{ color: '#ffffff' }}>
              {userStats.droidsCreated}
            </div>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Droids Created
            </p>
          </div>

          <div
            className="rounded-lg p-4 text-center transition-all duration-200"
            style={{
              background: '#090A0C',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex justify-center mb-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11L12 14L22 4" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-2xl font-bold mb-1 leading-none" style={{ color: '#ffffff' }}>
              {userStats.droidsUsed}
            </div>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Tasks Completed
            </p>
          </div>
        </div>
      </div>

      {/* Favorite Template - More spacious */}
      {userStats.favoriteTemplate && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15 8.5L22 9.5L17 14.5L18 21.5L12 18L6 21.5L7 14.5L2 9.5L9 8.5L12 2Z" fill="var(--accent-color)" />
            </svg>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
              Favorite Template
            </h4>
          </div>
          <div
            className="inline-block px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: 'rgba(107, 114, 128, 0.2)',
              color: '#9ca3af',
              border: '1px solid rgba(107, 114, 128, 0.3)',
            }}
          >
            {userStats.favoriteTemplate}
          </div>
        </div>
      )}
    </div>
  );
}
