const XPMeter = ({ currentXP, maxXP = 1000, showLabel = true }) => {
  const percentage = Math.min((currentXP / maxXP) * 100, 100);
  
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Experience Points</span>
          <span className="text-sm font-bold text-purple-600">{currentXP} XP</span>
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
        </div>
      </div>
      
      {showLabel && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">Level {Math.floor(currentXP / 100) + 1}</span>
          <span className="text-xs text-gray-500">Next: {Math.ceil(currentXP / 100) * 100} XP</span>
        </div>
      )}
    </div>
  );
};

export default XPMeter;