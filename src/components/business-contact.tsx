import {business} from "@/lib/business";
export function BusinessContact(){return <address className="business-contact"><a href={`mailto:${business.email}`}>{business.email}</a><a href={business.tel}>{business.phone}</a><a href={business.whatsapp} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></address>}
