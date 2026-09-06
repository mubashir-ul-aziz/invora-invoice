import { Alert } from 'react-native';

import {
  openEmail,
  openGoogleMaps,
  openPhone,
  openWebsite,
  openWhatsApp,
  type LinkingClient,
} from '../linking';

function fakeClient(canOpen: boolean): LinkingClient & { opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    canOpenURL: jest.fn().mockResolvedValue(canOpen),
    openURL: jest.fn((url: string) => {
      opened.push(url);
      return Promise.resolve();
    }),
  };
}

describe('linking helpers', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens a normalized tel: URL for a phone number', async () => {
    const client = fakeClient(true);
    const ok = await openPhone('+1 (555) 123-4567', client);
    expect(ok).toBe(true);
    expect(client.opened).toEqual(['tel:+15551234567']);
  });

  it('opens a mailto: URL with an encoded subject/body', async () => {
    const client = fakeClient(true);
    await openEmail('jane@acme.com', { subject: 'Hi there' }, client);
    expect(client.opened[0]).toBe('mailto:jane@acme.com?subject=Hi+there');
  });

  it('normalizes bare domains before opening a website', async () => {
    const client = fakeClient(true);
    await openWebsite('acme.com', client);
    expect(client.opened).toEqual(['https://acme.com']);
  });

  it('builds a wa.me link for WhatsApp', async () => {
    const client = fakeClient(true);
    await openWhatsApp('+15551234567', 'Hello', client);
    expect(client.opened).toEqual(['https://wa.me/15551234567?text=Hello']);
  });

  it('derives a Google Maps search URL from the address when no explicit link is set', async () => {
    const client = fakeClient(true);
    await openGoogleMaps({ address: '1 Main St' }, client);
    expect(client.opened).toEqual([
      'https://www.google.com/maps/search/?api=1&query=1%20Main%20St',
    ]);
  });

  it('prefers an explicit Google Maps link over the address', async () => {
    const client = fakeClient(true);
    await openGoogleMaps({ address: '1 Main St', mapsUrl: 'https://maps.app/xyz' }, client);
    expect(client.opened).toEqual(['https://maps.app/xyz']);
  });

  it('alerts and does nothing when there is no address or maps link', async () => {
    const client = fakeClient(true);
    const ok = await openGoogleMaps({}, client);
    expect(ok).toBe(false);
    expect(client.opened).toEqual([]);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('alerts instead of throwing when the target app cannot be opened', async () => {
    const client = fakeClient(false);
    const ok = await openPhone('+15551234567', client);
    expect(ok).toBe(false);
    expect(client.opened).toEqual([]);
    expect(Alert.alert).toHaveBeenCalled();
  });
});
