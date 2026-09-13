import {it,expect} from 'vitest';
import {toMinor,draftCopy,slugify} from './product-draft';
import {reportRange,csvCell} from './reporting';
import {orderMessage} from './business';
it('uses exact integer pesewas and rejects excessive precision',()=>{expect(toMinor('12.35')).toBe(1235);expect(toMinor('0.29')).toBe(29);expect(()=>toMinor('1.001')).toThrow();expect(()=>toMinor('-5')).toThrow()});
it('generates editable factual copy with bounded SEO text',()=>{expect(slugify('Salon Chair — Blue')).toBe('salon-chair-blue');const c=draftCopy('Chair','Salon furniture','Colour: blue');expect(c.description).toContain('Colour: blue');expect(c.description).not.toContain('warranty');expect(c.seo_title.length).toBeLessThanOrEqual(60);expect(c.seo_description.length).toBeLessThanOrEqual(160)});
it('handles Accra date boundaries and rejects impossible dates',()=>{expect(reportRange({range:'7'},new Date('2026-09-13T00:00:00Z'))).toEqual({from:'2026-09-07',to:'2026-09-13'});expect(()=>reportRange({range:'custom',from:'2026-02-30',to:'2026-03-01'})).toThrow();expect(csvCell('=CMD()')).toBe('"\'=CMD()"')});
it('WhatsApp message contains only public product information',()=>{const m=orderMessage({name:'Chair',slug:'chair',price:12345});expect(m).toContain('GHS 123.45');expect(m).toContain('https://blendandbeam.com/products/chair');expect(m).not.toContain('cost_minor')});
