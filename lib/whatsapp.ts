const NUMBER = "994993632026"; // 099-363-20-26 in international format
export const OWNER_MESSAGE = "Salam!Mən evimi satmaq istəyirəm."; // exact required text
export const whatsappUrl = (text: string): string => `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;
export const ownerWhatsAppUrl = whatsappUrl(OWNER_MESSAGE);
export const buyerWhatsAppUrl = (propertyTitle: string): string =>
  whatsappUrl(`Salam! ${propertyTitle} elanı haqqında məlumat almaq istəyirəm.`);

/** Pre-filled messages for the three service cards. Always Azerbaijani, never contain a price. */
export const SERVICE_MESSAGES = {
  presentation: "Salam! VizooHome əmlakın peşəkar təqdimatı xidməti ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?",
  shooting: "Salam! VizooHome çəkiliş paketi ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?",
  realtor: "Salam! VizooHome Rieltor paketi ilə maraqlanıram. Ətraflı məlumat verə bilərsiniz?",
} as const;
export type ServiceKey = keyof typeof SERVICE_MESSAGES;
export const serviceWhatsAppUrl = (key: ServiceKey): string => whatsappUrl(SERVICE_MESSAGES[key]);
