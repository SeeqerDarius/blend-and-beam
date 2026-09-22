export type AuditRow={id:string;actor_id:string|null;action:string;entity_type:string;created_at:string;metadata:unknown};
const verbs:Record<string,string>={insert:"created",update:"updated",delete:"deleted",cod_payment_received:"recorded a cash-on-delivery payment for"};
const entities:Record<string,string>={products:"product",categories:"category",brands:"brand",product_variants:"variant",product_images:"product image",product_categories:"category assignment",inventory:"inventory",orders:"order",reviews:"review",discount_codes:"discount code",shipping_zones:"delivery zone",site_content:"content page",user_roles:"staff access"};
export function describeAudit(row:Pick<AuditRow,"action"|"entity_type"|"metadata">){
 const verb=verbs[row.action]??row.action.replaceAll("_"," ");
 const entity=entities[row.entity_type]??row.entity_type.replaceAll("_"," ");
 const label=(row.metadata as {label?:string|null}|null)?.label??null;
 return {verb,entity,label};
}
