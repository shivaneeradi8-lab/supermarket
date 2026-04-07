import Ably from 'ably';

let ablyClient: Ably.Rest | null = null;

export function getAblyClient() {
  if (!process.env.ABLY_API_KEY) {
    return null;
  }

  if (!ablyClient) {
    ablyClient = new Ably.Rest(process.env.ABLY_API_KEY);
  }

  return ablyClient;
}

export async function publishDeliveryLocation(orderId: string, payload: Record<string, unknown>) {
  const client = getAblyClient();
  if (!client) {
    return false;
  }

  const channel = client.channels.get(`order:${orderId}`);
  await channel.publish('delivery-location-updated', payload);
  return true;
}