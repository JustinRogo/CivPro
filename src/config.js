export function supportedDistricts(catalog){return catalog.districts.filter(d=>d.supported&&d.id!=='us')}
export function districtName(catalog,id){return catalog.districts.find(d=>d.id===id)?.name.replace(/^District of /,'')||'district'}
export function validDistrict(catalog,id){return id==='none'||supportedDistricts(catalog).some(d=>d.id===id)}
