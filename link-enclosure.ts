export const LINK_ISSUING_AUTHORITIES = ['Sub-Registrar Office (SRO)', 'Tahsildar & Joint Sub-Registrar Office'] as const;

export function linkEnclosureValues(fields: Record<string, string>): Record<string, string> {
  return {
    'Link Authority': LINK_ISSUING_AUTHORITIES.some(authority => authority === fields.municipalLinkAuthority)
      ? fields.municipalLinkAuthority : '',
  };
}
