import { Brain } from 'lucide-react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <Brain 
            size={48} 
            className="text-purple-500 animate-pulse mx-auto mb-4" 
          />
          <div className="absolute -inset-2 bg-purple-200 rounded-full opacity-20 animate-ping"></div>
        </div>
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;