import React from 'react';
import { createRoot } from 'react-dom/client';

const IconGenerator = () => {
  return (
    <div style={{ width: '512px', height: '512px', backgroundColor: '#2196F3', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'white', fontSize: '48px', fontWeight: 'bold' }}>BP</div>
    </div>
  );
};

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
root.render(<IconGenerator />); 