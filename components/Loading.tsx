import React from 'react';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = "Thinking..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="loader"></div>
      <p className="text-java-accent font-mono animate-pulse">{message}</p>
    </div>
  );
};
