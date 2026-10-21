'use client';

import React from 'react';
import { API_CONFIG, APP_CONFIG, FEATURE_FLAGS, isDevelopment } from '../lib/utils/env';

/**
 * Example component demonstrating how to use environment variables
 * This component shows how to access and use environment variables in your React components
 */
export const EnvExample: React.FC = () => {
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Environment Variables Example</h3>

      <div className="space-y-2">
        <div>
          <strong>App Name:</strong> {APP_CONFIG.name}
        </div>

        <div>
          <strong>App Version:</strong> {APP_CONFIG.version}
        </div>

        <div>
          <strong>Environment:</strong> {APP_CONFIG.environment}
        </div>

        <div>
          <strong>API Base URL:</strong> {API_CONFIG.baseUrl}
        </div>

        <div>
          <strong>API Timeout:</strong> {API_CONFIG.timeout}ms
        </div>

        <div>
          <strong>Debug Mode:</strong> {FEATURE_FLAGS.enableDebug ? 'Enabled' : 'Disabled'}
        </div>

        <div>
          <strong>Analytics:</strong> {FEATURE_FLAGS.enableAnalytics ? 'Enabled' : 'Disabled'}
        </div>

        <div>
          <strong>Is Development:</strong> {isDevelopment() ? 'Yes' : 'No'}
        </div>
      </div>

      {isDevelopment() && (
        <div className="mt-4 p-2 bg-yellow-100 rounded">
          <p className="text-sm text-yellow-800">This message only shows in development mode!</p>
        </div>
      )}
    </div>
  );
};
