import React from 'react';
import MapView from './components/MapView';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/globals.css';

function App() {
  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 relative">
          <MapView 
            autoRefresh={true}
            refreshInterval={30000}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;