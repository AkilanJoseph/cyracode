/**
 * The payload encoded in a CyraCode QR code: an OpenStreetMap URL, so scanning
 * drops the reader straight onto the location at street-level zoom instead of a
 * generic map centred on nothing. Shared by the confirmation screen and the
 * Manage CyraCodes view modal so the two can never encode different things.
 */
export function cyraCodeQrValue({ latitude, longitude }) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
}
