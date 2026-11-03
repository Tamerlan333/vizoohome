const NUMBER = "994993632026"; // 099-363-20-26 in international format
export const OWNER_MESSAGE = "Salam!Mən evimi satmaq istəyirəm."; // exact required text
export const whatsappUrl = (text: string): string => `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;
export const ownerWhatsAppUrl = whatsappUrl(OWNER_MESSAGE);
export const buyerWhatsAppUrl = (propertyTitle: string): string =>
  whatsappUrl(`Salam! ${propertyTitle} elanı haqqında məlumat almaq istəyirəm.`);
