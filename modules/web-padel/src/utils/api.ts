export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  if (typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1' && 
      window.location.hostname !== '' &&
      (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return envUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
  }
  return envUrl;
};

export const apiUrl = getApiUrl();