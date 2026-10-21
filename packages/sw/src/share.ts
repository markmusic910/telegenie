declare const self: ServiceWorkerGlobalScope;

type ShareData = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};

export async function respondForShare(e: FetchEvent) {
  if (e.request.method === 'POST') {
    try {
      const formData = await e.request.formData();
      const data = parseFormData(formData);
      void requestShare(data, e.resultingClientId);
    } catch (err) {
      console.warn('[SHARE] Failed to parse input data', err);
    }
  }

  return Response.redirect('.');
}

async function requestShare(data: ShareData, clientId: string) {
  const client = await self.clients.get(clientId);
  if (!client) {
    return;
  }

  client.postMessage({
    type: 'share',
    payload: data,
  });
}

function parseFormData(formData: FormData): ShareData {
  const files = formData.getAll('files') as File[];
  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const url = formData.get('url') as string;

  return {
    title,
    text,
    url,
    files,
  };
}
