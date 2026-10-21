require('fake-indexeddb/auto');

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

jest.mock('@telegenie/agent/worker/create-default-agent-worker', () => ({
  createDefaultAgentWorker: () => ({}),
}));
