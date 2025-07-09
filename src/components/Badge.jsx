const Badge = ({ badge, size = 'md' }) => {
  const badgeConfig = {
    'first-hundred': { emoji: '💯', name: 'First Hundred', color: 'from-yellow-400 to-orange-500' },
    'xp-master': { emoji: '🏆', name: 'XP Master', color: 'from-purple-500 to-pink-500' },
    'quiz-champ': { emoji: '🧠', name: 'Quiz Champion', color: 'from-blue-500 to-green-500' },
    'streak-master': { emoji: '🔥', name: 'Streak Master', color: 'from-red-500 to-yellow-500' },
    'chat-explorer': { emoji: '💬', name: 'Chat Explorer', color: 'from-teal-500 to-blue-500' }
  };

  const config = badgeConfig[badge] || { emoji: '🏅', name: badge, color: 'from-gray-400 to-gray-600' };
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base'
  };

  return (
    <div 
      className={`${sizeClasses[size]} bg-gradient-to-r ${config.color} rounded-full flex items-center justify-center shadow-lg relative group cursor-pointer transform hover:scale-110 transition-transform`}
      title={config.name}
    >
      <span className="text-white font-bold">{config.emoji}</span>
      
      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {config.name}
      </div>
    </div>
  );
};

export default Badge;